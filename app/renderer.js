const path = require('path')
const {ipcRenderer} = require('electron');
// require('@electron/remote/main').enable(WebContents);
const remote = require('@electron/remote');

const mainProcess = remote.require('./main');
const currentWindow = remote.getCurrentWindow();

const codeView = document.querySelector('#code');
const inputView = document.querySelector('#input');
const instrView = document.querySelector('#instr');
const infoView = document.querySelector('#info');
const stackView = document.querySelector('#stack');
const newFileButton = document.querySelector('#new-file');
const openFileButton = document.querySelector('#open-file');
const saveButton = document.querySelector('#save');
const revertButton = document.querySelector('#revert');
const runButton = document.querySelector('#run');
const stepRunButton = document.querySelector('#step-run');
const stopButton = document.querySelector('#stop');
const nextstepButton = document.querySelector('#next-step');

let filePath = null;
let originalContent = '';
let next_instr = null;

const isDifferentContent = (content) => content !== codeView.value;

const renderMarkdownToHTML = (markdown) => {
    instrView.innerHTML = '';
}

const renderFile = (file, content) => {
    filePath = file;
    originalContent = content;
    codeView.value = content;
    renderMarkdownToHTML(content);
    updateUserInterface(false);
}

const updateUserInterface = (isEdited) => {
    let title = 'X0';
    if (filePath) {title = `${path.basename(filePath)} - ${title}`;}
    if (isEdited) {title = `${title} (Edited)`;}
    currentWindow.setTitle(title);
    currentWindow.setDocumentEdited(isEdited);

    saveButton.disabled = !isEdited;
    revertButton.disabled = !isEdited;
}

codeView.addEventListener('keyup', (event) => {
    const currentContent = event.target.value;
    renderMarkdownToHTML(currentContent);
    updateUserInterface(currentContent !== originalContent);
})

newFileButton.addEventListener('click', () => {
    mainProcess.createWindow();
})

openFileButton.addEventListener('click', () => {
    console.log(mainProcess);
    mainProcess.getFileFromUser(currentWindow);
})

runButton.addEventListener('click', () => {
    const inputs = inputView.value + '\n';
    mainProcess.execCompile(currentWindow, filePath, inputs, false);
})

stepRunButton.addEventListener('click', () => {
    const inputs = inputView.value + '\n';
    mainProcess.execCompile(currentWindow, filePath, inputs, false);
    infoView.value = '';
    mainProcess.execCompile(currentWindow, filePath, inputs, true);
    stepRunButton.classList.add('hide');
    runButton.classList.add('hide');
    nextstepButton.classList.remove('hide');
    stopButton.classList.remove('hide');
})

nextstepButton.addEventListener('click', () => {
    mainProcess.nextStep(currentWindow);
})

stopButton.addEventListener('click', () => {
    mainProcess.stopProcess(currentWindow);
})

saveButton.addEventListener('click', () => {
    mainProcess.save(currentWindow, filePath, codeView.value);
    console.log(filePath);
})

revertButton.addEventListener('click', () => {
    codeView.value = originalContent;
    renderMarkdownToHTML(originalContent);
})

codeView.addEventListener('dragover', (event) => {
    const file = getDraggedFile(event);
    if (fileTypeIsSupported(file)) {
        codeView.classList.add('drag-over');
    } else {
        codeView.classList.add('drag-error');
    }
})

codeView.addEventListener('dragleave', () => {
    codeView.classList.remove('drag-over');
    codeView.classList.remove('drag-error');
})

codeView.addEventListener('drop', (event) => {
    const file = getDroppedFile(event);
    if (fileTypeIsSupported(file)) {
        mainProcess.openFile(currentWindow, file.path);
    } else {
        alert('That file type is not supported');
    }
    codeView.classList.remove('drag-over');
    codeView.classList.remove('drag-error');
})

document.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('dragleave', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

const getDraggedFile = (event) => event.dataTransfer.items[0];
const getDroppedFile = (event) => event.dataTransfer.files[0];
const fileTypeIsSupported = (file) => {
    return ['text/plain', 'text/markdown', ''].includes(file.type);
}

ipcRenderer.on('file-opened', (event, file, content) => {
    console.log(event, file, content);
    if (currentWindow.isDocumentEdited() && isDifferentContent((content))) {
        const result = remote.dialog.showMessageBoxSync(currentWindow, {
            type: 'warning',
            title: 'Overwrite Current Unsaved Changes?',
            message: 'Opening a new file in this window will overwrite your unsaved changes. Open this file anyway?',
            buttons: [
                'Yes',
                'Cancel',
            ],
            defaultId: 0,
            cancelId: 1
        })

        if (result === 1) {return;}
    }
    renderFile(file, content);
})

ipcRenderer.on('file-changed', (event, file, content) => {
    if (!isDifferentContent(content)) return;
    const result = remote.dialog.showMessageBoxSync(currentWindow, {
        type: 'warning',
        title: 'Overwrite Current Unsaved Changes?',
        message: 'Another application has changed this file. Load changes?',
        buttons: [
            'Yes',
            'Cancel',
        ],
        defaultId: 0,
        cancelId: 1
    })

    renderFile(file, content);
})

ipcRenderer.on('compile', (event, instructions, info, error) => {
    console.log(instructions, info, error);
    instrView.innerHTML = instructions ? instr_parser(instructions.trim().split('\n')) : '';
    infoView.value = info;
})

ipcRenderer.on('p', (event, p) => {
    if (next_instr) next_instr.classList.remove('next-instr');
    next_instr = document.querySelector(`#i-${p}`);
    next_instr.classList.add('next-instr');
})

ipcRenderer.on('exit', (event) => {
    stepRunButton.classList.remove('hide');
    runButton.classList.remove('hide');
    nextstepButton.classList.add('hide');
    stopButton.classList.add('hide');
})

ipcRenderer.on('stack', (event, stack) => {
    stackView.innerHTML = stack ? stack_parser(stack.trim().split('\n')) : '';
})

const instr_parser = (instrs) => {
    if (!instrs) return '';
    let instr_tags = '';
    for (const instr of instrs) {
        const [index, code, p1, p2] = instr.split(' ');
        const instr_tag = `<tr class="instruction" id="i-${index}"><td>${index}</td> <td>${code}</td> <td>${p1}</td> <td>${p2}</td></tr>`
        instr_tags += instr_tag;
    }
    return '<table>' + instr_tags + '</table>';
}

const stack_parser = (cells) => {
    if (!cells) return '';
    let stack_tags = '';
    for (const cell of cells) {
        const cell_tag = `<tr class="stack-cell"> <td>${cell}</td> </tr>`
        stack_tags += cell_tag;
    }
    return '<table>' + stack_tags + '</table>';
}