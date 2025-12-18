import { App, Plugin, PluginSettingTab, Setting, TFolder, TFile, FuzzySuggestModal, Notice, normalizePath, TAbstractFile, Modal, moment } from 'obsidian';
import { minimatch } from 'minimatch';
import * as fs from 'fs';
import * as path from 'path';

interface NotemixSettings {
	excludeGlob: string;
    ignoreRootFiles: boolean;
    defaultExportPath: string;
    fileNameTemplate: string;
    dateFormat: string;
}

const DEFAULT_SETTINGS: NotemixSettings = {
	excludeGlob: '',
    ignoreRootFiles: false,
    defaultExportPath: '',
    fileNameTemplate: '{foldername}_{YYYY.MM.DD HH.mm.ss}.md',
    dateFormat: 'YYYY.MM.DD HH.mm.ss'
}

export default class NotemixPlugin extends Plugin {
	settings: NotemixSettings;

	async onload() {
		await this.loadSettings();

		// Command to mix notes from a suggested folder
		this.addCommand({
			id: 'mix-notes-from-folder',
			name: 'Mix notes from folder',
			callback: () => {
				new FolderSuggestModal(this.app, (folder) => {
                    this.promptForDestination(folder);
                }).open();
			}
		});

		// Context Menu Item
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('Mix notes')
							.setIcon('documents')
							.onClick(async () => {
								this.promptForDestination(file);
							});
					});
				}
			})
		);

		this.addSettingTab(new NotemixSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    async promptForDestination(folder: TFolder) {
        // Use default export path if set, otherwise default to folder/<filename>
        let defaultPath = "";
        
        // Generate filename based on template
        let fileName = this.settings.fileNameTemplate;
        
        // Replace {foldername}
        fileName = fileName.replace(/{foldername}/g, folder.name);
        
        // Replace {date} with configured date format
        fileName = fileName.replace(/{date}/g, moment().format(this.settings.dateFormat));
        
        // Replace other custom date patterns like {YYYY-MM-DD}
        fileName = fileName.replace(/{([^}]+)}/g, (match, pattern) => {
            // Check if it looks like a date format (this is loose, but moments format is flexible)
            // We assume anything else in curly braces is potentially a date format if not 'foldername' or 'date' (already handled)
            return moment().format(pattern);
        });

        if (!fileName.endsWith('.md')) {
            fileName += '.md';
        }

        if (this.settings.defaultExportPath) {
             defaultPath = this.settings.defaultExportPath;
             // If it looks like a directory (doesn't end in .md), append filename
             if (!defaultPath.endsWith('.md')) { 
                 defaultPath = path.join(defaultPath, fileName);
             }
             
             // Ensure vault paths are normalized if not absolute
             if (!path.isAbsolute(defaultPath)) {
                 defaultPath = normalizePath(defaultPath);
             }
        } else {
            defaultPath = normalizePath(folder.path + `/${fileName}`);
        }

        new DestinationModal(this.app, defaultPath, async (resultPath) => {
             await this.combineNotes(folder, resultPath);
        }).open();
    }

    async combineNotes(folder: TFolder, destinationPath: string) {
        new Notice(`Mixing notes from ${folder.path}...`);
        
        let files: TFile[] = [];
        this.collectFiles(folder, files);

        // Filter files
        if (this.settings.excludeGlob) {
            files = files.filter(file => !minimatch(file.path, this.settings.excludeGlob, { matchBase: true }));
        }

        files.sort((a, b) => a.basename.localeCompare(b.basename));

        let combinedContent = "";

        for (const file of files) {
            const content = await this.app.vault.read(file);
            combinedContent += `<!-- Start: ${file.basename} -->\n${content}\n<!-- End: ${file.basename} -->\n\n`;
        }
        
        // Ensure extension
        if (!destinationPath.endsWith('.md')) {
            destinationPath += '.md';
        }

        try {
            if (path.isAbsolute(destinationPath)) {
                // System path
                fs.writeFileSync(destinationPath, combinedContent);
                new Notice(`Created: ${destinationPath}`);
            } else {
                // Vault path
                 const existingFile = this.app.vault.getAbstractFileByPath(destinationPath);
                if (existingFile instanceof TFile) {
                    await this.app.vault.modify(existingFile, combinedContent);
                    new Notice(`Updated: ${destinationPath}`);
                } else {
                    // Create folders if they don't exist logic could be good here but skipping for simplicity as per previous code
                    await this.app.vault.create(destinationPath, combinedContent);
                    new Notice(`Created: ${destinationPath}`);
                }
            }
           
        } catch (error) {
            new Notice(`Error creating file: ${error}`);
            console.error(error);
        }
    }

    collectFiles(folder: TFolder, files: TFile[]) {
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                this.collectFiles(child, files);
            }
        }
    }
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
    callback: (folder: TFolder) => void;

    constructor(app: App, callback: (folder: TFolder) => void) {
        super(app);
        this.callback = callback;
    }

    getItems(): TFolder[] {
        const folders: TFolder[] = [];
        this.app.vault.getAllLoadedFiles().forEach(file => {
            if (file instanceof TFolder) {
                folders.push(file);
            }
        });
        return folders;
    }

    getItemText(item: TFolder): string {
        return item.path;
    }

    onChooseItem(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.callback(item);
    }
}

class DestinationModal extends Modal {
    destination: string;
    onSubmit: (result: string) => void;
    defaultPath: string;

    constructor(app: App, defaultPath: string, onSubmit: (result: string) => void) {
        super(app);
        this.defaultPath = defaultPath;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Destination for Mixed Note" });

        const inputContainer = contentEl.createDiv();
        const input = inputContainer.createEl("input", { type: "text", value: this.defaultPath });
        input.style.width = "100%";

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = "10px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";

        const btn = buttonContainer.createEl("button", { text: "Mix" });
        btn.onclick = () => {
            this.onSubmit(input.value);
            this.close();
        };
        
        input.focus();
        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                this.onSubmit(input.value);
                this.close();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class NotemixSettingTab extends PluginSettingTab {
	plugin: NotemixPlugin;

	constructor(app: App, plugin: NotemixPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Notemix'});

		new Setting(containerEl)
			.setName('Exclude Glob Pattern')
			.setDesc('Files matching this glob pattern will be excluded. Example: **/*.draft.md')
			.addText(text => text
				.setPlaceholder('**/Secret/**')
				.setValue(this.plugin.settings.excludeGlob)
				.onChange(async (value) => {
					this.plugin.settings.excludeGlob = value;
					await this.plugin.saveSettings();
				}));

        new Setting(containerEl)
            .setName('Default Export Path')
            .setDesc('Absolute path or relative vault path to save combined notes by default. If empty, defaults to folder location.')
            .addText(text => text
                .setPlaceholder('C:/Users/Name/Documents/')
                .setValue(this.plugin.settings.defaultExportPath)
                .onChange(async (value) => {
                    this.plugin.settings.defaultExportPath = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('File Name Template')
            .setDesc('Template for the generated file name. Use {foldername} for the folder name, {date} for formatted date, or {FormatString} for moment.js date format (e.g. {YYYY-MM-DD}).')
            .addText(text => text
                .setPlaceholder('{foldername}_{YYYY.MM.DD HH.mm.ss}.md')
                .setValue(this.plugin.settings.fileNameTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.fileNameTemplate = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Date Format')
            .setDesc('Format to use for the {date} placeholder.')
            .addText(text => text
                .setPlaceholder('YYYY.MM.DD HH.mm.ss')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));
	}
}
