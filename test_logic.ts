// @ts-nocheck
const { minimatch } = require('minimatch');

// Mock classes
class TFile {
    constructor(path, content) {
        this.path = path;
        this.basename = path.split('/').pop().replace(/\.[^/.]+$/, "");
        this.extension = path.split('.').pop();
        this.content = content;
    }
}

class TFolder {
    constructor(path, children = []) {
        this.path = path;
        this.name = path.split('/').pop();
        this.children = children;
    }
}

// Mock moment
const moment = () => ({
    format: (fmt) => {
        if (fmt === 'YYYY.MM.DD HH.mm.ss') return '2023.10.27 10.30.45'; // Fixed mock date
        if (fmt === 'YYYY-MM-DD') return '2023-10-27';
        if (fmt === 'MM-DD-YYYY') return '10-27-2023';
        return fmt; // fallback
    }
});

// Logic from main.ts (adapted for test)
function collectFiles(folder, files) {
    for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
            files.push(child);
        } else if (child instanceof TFolder) {
            collectFiles(child, files);
        }
    }
}

// Logic to test
function generateFileName(template, folderName, dateFormat) {
    let fileName = template;
    
    // Replace {foldername}
    fileName = fileName.replace(/{foldername}/g, folderName);
    
    // Replace {date} with configured date format
    fileName = fileName.replace(/{date}/g, moment().format(dateFormat));
    
    // Replace other custom date patterns
    fileName = fileName.replace(/{([^}]+)}/g, (match, pattern) => {
        return moment().format(pattern);
    });

    if (!fileName.endsWith('.md')) {
        fileName += '.md';
    }
    return fileName;
}


async function runTest() {
    console.log("Setting up test files...");
    
    const file1 = new TFile('folder/note1.md', '# Note 1\nContent 1');
    const file2 = new TFile('folder/sub/note2.md', '# Note 2\nContent 2');
    const file3 = new TFile('folder/secret.md', '# Secret\nHidden content');
    const file4 = new TFile('folder/image.png', 'PNG content'); // Should be ignored

    const subFolder = new TFolder('folder/sub', [file2]);
    const rootFolder = new TFolder('folder', [file1, subFolder, file3, file4]);

    console.log("Testing file collection...");
    let files = [];
    collectFiles(rootFolder, files);

    if (files.length !== 3) {
        console.error(`FAILED: Expected 3 markdown files, got ${files.length}`);
        process.exit(1);
    } else {
        console.log("PASSED: File collection count correct.");
    }

    console.log("Testing Glob Exclusion (exclude secret.md)...");
    const docExcludeGlob = '**/secret.md';
    files = files.filter(file => !minimatch(file.path, docExcludeGlob, { matchBase: true }));

    if (files.length !== 2) {
        console.error(`FAILED: Expected 2 files after exclusion, got ${files.length}. Content: ${files.map(f => f.path).join(', ')}`);
        process.exit(1);
    } else {
        console.log("PASSED: Glob exclusion works.");
    }
    
    // Sort
    files.sort((a, b) => a.basename.localeCompare(b.basename));

    console.log("Testing Combination Content...");
    let combinedContent = "";
    for (const file of files) {
        const content = file.content;
        combinedContent += `<!-- Start: ${file.basename} -->\n${content}\n<!-- End: ${file.basename} -->\n\n`;
    }

    const expectedContent = `<!-- Start: note1 -->
# Note 1
Content 1
<!-- End: note1 -->

<!-- Start: note2 -->
# Note 2
Content 2
<!-- End: note2 -->

`;

    if (combinedContent === expectedContent) {
        console.log("PASSED: Combined content matches expected format.");
    } else {
        console.error("FAILED: Content mismatch.");
        console.log("EXPECTED:\n" + expectedContent);
        console.log("ACTUAL:\n" + combinedContent);
        process.exit(1);
    }

    // --- NEW TESTS FOR FILE NAME ---
    console.log("Testing File Name Generation...");
    
    // Test Case 1: Default Settings
    // Template: {foldername}_{YYYY.MM.DD HH.mm.ss}.md
    // Folder: 'ProjectX'
    const t1 = generateFileName('{foldername}_{YYYY.MM.DD HH.mm.ss}.md', 'ProjectX', 'YYYY.MM.DD HH.mm.ss');
    const e1 = 'ProjectX_2023.10.27 10.30.45.md';
    if (t1 === e1) {
        console.log("PASSED: Default template generation.");
    } else {
        console.error(`FAILED: Default template. Expected '${e1}', got '${t1}'`);
        process.exit(1);
    }

    // Test Case 2: Custom Pattern inside {}
    // Template: Backup-{foldername}-{MM-DD-YYYY}
    const t2 = generateFileName('Backup-{foldername}-{MM-DD-YYYY}', 'MyDocs', 'YYYY-MM-DD'); 
    // dateFormat argument doesn't matter for specific pattern match
    const e2 = 'Backup-MyDocs-10-27-2023.md';
    if (t2 === e2) {
        console.log("PASSED: Custom date pattern.");
    } else {
        console.error(`FAILED: Custom date pattern. Expected '${e2}', got '${t2}'`);
        process.exit(1);
    }

    // Test Case 3: Using {date} placeholder
    // Template: {foldername} - {date}
    // DateFormat: YYYY-MM-DD
    const t3 = generateFileName('{foldername} - {date}', 'Notes', 'YYYY-MM-DD');
    const e3 = 'Notes - 2023-10-27.md';
    if (t3 === e3) {
        console.log("PASSED: {date} placeholder.");
    } else {
        console.error(`FAILED: {date} placeholder. Expected '${e3}', got '${t3}'`);
        process.exit(1);
    }

    // Test Case 4: No Variables
    const t4 = generateFileName('StaticName', 'Folder', 'YYYY');
    const e4 = 'StaticName.md';
    if (t4 === e4) {
        console.log("PASSED: Static name.");
    } else {
        console.error(`FAILED: Static name. Expected '${e4}', got '${t4}'`);
        process.exit(1);
    }
}

runTest();
