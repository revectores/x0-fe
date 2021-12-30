const {app, BrowserWindow, dialog, WebContents} = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn, fork } = require('child_process');
require('@electron/remote/main').initialize()

let proc;
const windows = new Set();
const openFiles = new Map();
const fout = path.join(app.getAppPath(), 'fout.txt');
const fcode = path.join(app.getAppPath(), 'fcode.txt');
const fresult = path.join(app.getAppPath(), 'fresult.txt');
const fstack = path.join(app.getAppPath(), 'fstack.txt');
const ftable = path.join(app.getAppPath(), 'ftable.txt');
const x0_path = path.join(app.getAppPath(), 'x0/x0');
const compiler_path = path.join(app.getAppPath(), 'app/compile')

app.on('ready', () => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
        return false;
    }
    app.quit();
});

app.on('will-finish-launching', () => {
    app.on('open-file', (event, file) => {
        const win = createWindow();
        win.once('ready-to-show', () => {
            openFile(win, file);
        })
    })
})

app.on('activate', (event, hasVisibleWindows) => {
    if (!hasVisibleWindows) {createWindow();}
})

const createWindow = exports.createWindow = () => {
    let x, y;

    const currentWindow = BrowserWindow.getFocusedWindow();

    if (currentWindow) {
        const [currentWindowX, currentWindowY] = currentWindow.getPosition();
        x = currentWindowX + 10;
        y = currentWindowY + 10;
    }

    let newWindow = new BrowserWindow({
        x, y,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false
    });
    require('@electron/remote/main').enable(newWindow.webContents);
    newWindow.loadFile('./app/index.html');
    newWindow.once('ready-to-show', () => {
        newWindow.show();
    })
    newWindow.on('close', (event) => {
        if (newWindow.isDocumentEdited()) {
            event.preventDefault();

            const result = dialog.showMessageBoxSync(newWindow, {
                type: 'warning',
                title: 'Quit with Unsaved Changes?',
                message: 'Your changes will be lost if you do not save.',
                buttons: [
                    'Quit anyway',
                    'Cancel',
                ],
                defaultId: 0,
                cancelId: 1
            });
            if (result === 0) newWindow.destroy();
        }
    })
    newWindow.on('closed', () => {
        windows.delete(newWindow);
        stopWatchingFile(newWindow);
        newWindow = null;
    })
    // watchInstructionFile(newWindow);
    windows.add(newWindow);
    return newWindow;
}

const getFileFromUser = exports.getFileFromUser = (targetWindow) => {
    const files = dialog.showOpenDialogSync(targetWindow, {
        properties: ['openFile'],
        filters: [
            {name: 'X0 sources', extensions: ['pl0']},
            {name: 'Text Files', extensions: ['txt']}
        ]
    });
    if (files) {openFile(targetWindow, files[0]);}
};

const execCompile = exports.execCompile = (targetWindow, filePath, input, step_mode) => {
    // proc = spawn(x0_path, [filePath, app.getAppPath(), step_mode ? '1' : '0']);
    proc = fork(compiler_path, [filePath, app.getAppPath(), step_mode], {silent: true});
    proc.exited = false;
    proc.stdin.write(input);
    proc.stdout.on('data', (data) => {
        data = data.toString();
        const matches = data.match(/#p#\d+\n/);
        if (matches) {
            targetWindow.webContents.send('p', parseInt(matches.at(-1).split('#').at(-1)));
            const stack = fs.readFileSync(fstack).toString();
            targetWindow.webContents.send('stack', stack);
        }
    });
    proc.stderr.on('data', (data) => {
        console.log(data);
        console.log(data.toString());
    });
    proc.on('exit', (code) => {
        proc.exited = true;
        if (step_mode) {
            targetWindow.webContents.send('exit');
        }
        const instructions = code ? '' : fs.readFileSync(fcode).toString();
        const info = fs.readFileSync(code ? fout : fresult).toString();
        targetWindow.webContents.send('compile', instructions, info, code);
        console.log(code);
    })
};

const nextStep = exports.nextStep = (targetWindow) => {
    proc.kill("SIGCONT");
}

const stopProcess = exports.stopProcess = (targetWindow) => {
    proc.kill('SIGTERM');
    proc.kill('SIGCONT');
}

const openFile = exports.openFile = (targetWindow, file) => {
    const content = fs.readFileSync(file).toString();
    app.addRecentDocument(file);
    targetWindow.setRepresentedFilename(file);
    targetWindow.webContents.send('file-opened', file, content);
    startWatchingFile(targetWindow, file);
};

const save = exports.save = (targetWindow, file, content) => {
    if (!file) {
        file = dialog.showSaveDialogSync(targetWindow, {
            title: 'Save Markdown',
            defaultPath: app.getPath('documents'),
            filters: [
                {name: 'PL0 Source', extensions: ['pl0']}
            ]
        });
    }
    if (!file) return;
    fs.writeFileSync(file, content);
    openFile(targetWindow, file);
}

const saveHTML = exports.saveHTML = (targetWindow, content) => {
    const file = dialog.showSaveDialogSync(targetWindow, {
        title: 'Save HTML',
        defaultPath: app.getPath('documents'),
        filters: [
            {name: 'HTML Files', extensions: ['html', 'htm']}
        ]
    });

    if (!file) return;
    fs.writeFileSync(file, content);
}

const startWatchingFile = (targetWindow, file) => {
    stopWatchingFile(targetWindow);

    const watcher = fs.watch(file, () => {
        const content = fs.readFileSync(file).toString();
        targetWindow.webContents.send('file-changed', file, content);
    });

    openFiles.set(targetWindow, watcher);
}

const stopWatchingFile = (targetWindow) => {
    if (openFiles.has(targetWindow)) {
        openFiles.get(targetWindow).close();
        openFiles.delete(targetWindow);
    }
}
