var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

// Language mapping
var languageOverrides = {
    js: 'javascript',
    html: 'xml'
};

// Configure emoji
emojify.setConfig({
    img_dir: 'emoji'
});

// Initialize markdown-it
var md = markdownit({
    html: true,
    highlight: function(code, lang) {
        if (languageOverrides[lang]) lang = languageOverrides[lang];
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(lang, code).value;
            } catch (e) {}
        }
        return '';
    }
}).use(markdownitFootnote);

var hashto;
var saveTimeout;

// Update editor content
function update(e) {
    setOutput(e.getValue());
    updateStats();
    updateSaveStatus('Editing');

    // Update document title
    var headerElements = document.querySelectorAll('h1');
    if (headerElements.length > 0 && headerElements[0].textContent.length > 0) {
        title = headerElements[0].textContent;
    } else {
        title = 'Markdown Pro';
    }

    var oldTitle = document.title;
    if (oldTitle != title) {
        oldTitle = title;
        document.title = title;
    }

    // Auto-save indicator
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function() {
        updateSaveStatus('Unsaved');
    }, 2000);
}

// Update status bar statistics
function updateStats() {
    var content = editor.getValue();
    
    // Word count
    var text = content.replace(/[#*`\[\]()_~>\-+=\s\n\r]+/g, ' ');
    var words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    document.getElementById('wordcount').textContent = 'Words: ' + words;
    
    // Character count
    var chars = content.length;
    document.getElementById('charcount').textContent = 'Characters: ' + chars;
    
    // Line count
    var lines = editor.lineCount();
    document.getElementById('linenumber').textContent = 'Lines: ' + lines;
}

// Update save status
function updateSaveStatus(status) {
    var statusEl = document.getElementById('save-status');
    statusEl.textContent = status;
    
    if (status === 'Saved') {
        statusEl.style.color = '#22c55e';
    } else if (status === 'Unsaved') {
        statusEl.style.color = '#f59e0b';
    } else if (status === 'Editing') {
        statusEl.style.color = '#94a3b8';
    }
}

// Render task list
var render_tasklist = function(str){
    // Checked task
    if(str.match(/<li>\[x\]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[x\]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
          checked style="list-style-type: none; 
          margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    // Unchecked task
    if (str.match(/<li>\[ \]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[ \]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
            style="list-style-type: none; 
            margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    return str
}

// Set output content
function setOutput(val) {
    val = val.replace(/<equation>((.*?\n)*?.*?)<\/equation>/ig, function(a, b) {
        return '<img src="http://latex.codecogs.com/png.latex?' + encodeURIComponent(b) + '" />';
    });

    var out = document.getElementById('out');
    var old = out.cloneNode(true);
    out.innerHTML = md.render(val);
    emojify.run(out);
    
    // Render task list
    out.innerHTML = render_tasklist(out.innerHTML);

    // Auto scroll to changed position
    var allold = old.getElementsByTagName("*");
    if (allold === undefined) return;

    var allnew = out.getElementsByTagName("*");
    if (allnew === undefined) return;

    for (var i = 0, max = Math.min(allold.length, allnew.length); i < max; i++) {
        if (!allold[i].isEqualNode(allnew[i])) {
            out.scrollTop = allnew[i].offsetTop;
            return;
        }
    }
}

// Initialize spell checker
CodeMirrorSpellChecker({
    codeMirrorInstance: CodeMirror,
});

// Create editor instance
var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    mode: "spell-checker",
    backdrop: "gfm",
    lineNumbers: false,
    matchBrackets: true,
    lineWrapping: true,
    theme: 'base16-light',
    extraKeys: {
        "Enter": "newlineAndIndentContinueMarkdownList"
    }
});

editor.on('change', update);

// Selected text handler
function selectionChanger(selection, operator, endoperator){
    if(selection == ""){
        return operator;
    }
    if(!endoperator){
        endoperator = operator
    }
    var isApplied = selection.slice(0, 2) === operator && selection.slice(-2) === endoperator;
    var finaltext = isApplied ? selection.slice(2, -2) : operator + selection + endoperator;
    return finaltext;
}

// Add keyboard shortcuts
editor.addKeyMap({
    // Bold
    'Ctrl-B': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'**'));
    },
    // Italic
    'Ctrl-I': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'_'));
    },
    // Code
    'Ctrl-K': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'`'));
    },
    // Keyboard shortcut tag
    'Ctrl-L': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'<kbd>','</kbd>'));
    }
});

// Drag and drop file handling
document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var reader = new FileReader();
    reader.onload = function(e) {
        editor.setValue(e.target.result);
    };

    reader.readAsText(e.dataTransfer.files[0]);
}, false);

// Save as Markdown
function saveAsMarkdown() {
    var content = editor.getValue();
    var title = content.match(/^#\s+(.+)$/m);
    var filename = title ? title[1].replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '_') : 'document';
    save(content, filename + ".md");
}

// Save as HTML
function saveAsHtml() {
    var htmlContent = document.getElementById('out').innerHTML;
    var title = htmlContent.match(/<h1[^>]*>(.+?)<\/h1>/);
    var filename = title ? title[1].replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '_') : 'document';
    
    // Add complete HTML structure
    var fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title ? title[1] : 'Document'}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #1A1A2E; }
        pre { background: #F1F5F9; padding: 16px; border-radius: 8px; overflow-x: auto; }
        code { background: #EEEBFF; color: #5B4DFF; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        blockquote { border-left: 4px solid #5B4DFF; padding-left: 16px; margin: 16px 0; color: #6B7280; }
        img { max-width: 100%; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; }
        th { background: #F1F5F9; font-weight: 600; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    
    save(fullHtml, filename + ".html");
}

document.getElementById('saveas-markdown').addEventListener('click', function() {
    saveAsMarkdown();
    hideMenu();
});

document.getElementById('saveas-html').addEventListener('click', function() {
    saveAsHtml();
    hideMenu();
});

// Save file function
function save(code, name) {
    var blob = new Blob([code], {
        type: 'text/plain;charset=utf-8'
    });
    if (window.saveAs) {
        window.saveAs(blob, name);
    } else if (navigator.saveBlob) {
        navigator.saveBlob(blob, name);
    } else {
        url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", name);
        var event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(event);
        setTimeout(function() {
            window.URL.revokeObjectURL(url);
        }, 100);
    }
    updateSaveStatus('Saved');
}

// Menu show/hide
var menuVisible = false;
var menu = document.getElementById('menu');

function showMenu() {
    menuVisible = true;
    menu.style.display = 'block';
    setTimeout(function() {
        menu.classList.add('show');
    }, 10);
}

function hideMenu() {
    menu.classList.remove('show');
    setTimeout(function() {
        menuVisible = false;
        menu.style.display = 'none';
    }, 200);
}

// Open file
function openFile(evt) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var files = evt.target.files;
        console.log(files);
        var reader = new FileReader();
        reader.onload = function(file) {
            console.log(file.target.result);
            editor.setValue(file.target.result);
            return true;
        };
        reader.readAsText(files[0]);

    } else {
        swal('Alert', 'Your browser does not support file operations', 'error');
    }
}

document.getElementById('close-menu').addEventListener('click', function() {
    hideMenu();
});

// Click outside menu to close
document.addEventListener('click', function(e) {
    if (menuVisible && !menu.contains(e.target) && e.target.id !== 'savebutton') {
        hideMenu();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+S save
    if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
        if (localStorage.getItem('content') == editor.getValue()) {
            e.preventDefault();
            return false;
        }
        e.shiftKey ? showMenu() : saveInBrowser();
        e.preventDefault();
        return false;
    }

    // ESC close menu
    if (e.keyCode === 27 && menuVisible) {
        hideMenu();
        e.preventDefault();
        return false;
    }
});

// Clear editor
function clearEditor() {
    if (editor.getValue().trim() !== '') {
        swal({
            title: 'Confirm Clear',
            text: 'Are you sure you want to clear the editor content?',
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#5B4DFF',
            confirmButtonText: 'Yes, clear it',
            cancelButtonText: 'Cancel'
        }, function() {
            editor.setValue('');
            updateStats();
        });
    }
}

// Browser save
function saveInBrowser() {
    var text = editor.getValue();
    if (localStorage.getItem('content')) {
        swal({
            title: 'Overwrite Existing Data',
            text: 'You already have saved data. Are you sure you want to overwrite it?',
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#5B4DFF',
            confirmButtonText: 'Yes, overwrite',
            cancelButtonText: 'Cancel'
        }, function() {
            localStorage.setItem('content', text);
            updateSaveStatus('Saved');
            swal('Saved Successfully', 'Your document has been saved to browser storage', 'success');
        });
    } else {
        localStorage.setItem('content', text);
        updateSaveStatus('Saved');
        swal('Saved Successfully', 'Your document has been saved to browser storage', 'success');
    }
}

// Toggle dark mode
function toggleNightMode(button) {
    button.classList.toggle('selected');
    document.getElementById('toplevel').classList.toggle('nightmode');
    
    // Update icon
    var icon = button.querySelector('.material-icons');
    if (button.classList.contains('selected')) {
        icon.textContent = 'light_mode';
    } else {
        icon.textContent = 'dark_mode';
    }
}

// Toggle reading mode
function toggleReadMode(button) {
    button.classList.toggle('selected');
    document.getElementById('out').classList.toggle('focused');
    document.getElementById('in').classList.toggle('hidden');
}

// Toggle spell check
function toggleSpellCheck(button) {
    button.classList.toggle('selected');
    document.body.classList.toggle('no-spellcheck');
}

// Generate share link
function updateHash() {
    var content = editor.getValue();
    if (!content || content.trim() === '') {
        swal('Alert', 'Editor content is empty, cannot share', 'warning');
        return;
    }
    
    var compressed = btoa(RawDeflate.deflate(unescape(encodeURIComponent(content))));
    window.location.hash = compressed;
    
    // Copy link to clipboard
    var shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(function() {
        swal('Share Success', 'Link has been copied to clipboard', 'success');
    }).catch(function() {
        window.prompt('Copy this link:', shareUrl);
    });
}

// Process query parameters
function processQueryParams() {
    var params = window.location.search.split('?')[1];
    if (window.location.hash) {
        document.getElementById('readbutton').click();
    }
    if (params) {
        var obj = {};
        params.split('&').forEach(function(elem) {
            obj[elem.split('=')[0]] = elem.split('=')[1];
        });
        if (obj.reading === 'false') {
            document.getElementById('readbutton').click();
        }
        if (obj.dark === 'true') {
            document.getElementById('nightbutton').click();
        }
    }
}

// Start application
function start() {
    processQueryParams();
    
    if (window.location.hash) {
        var h = window.location.hash.replace(/^#/, '');
        if (h.slice(0, 5) == 'view:') {
            setOutput(decodeURIComponent(escape(RawDeflate.inflate(atob(h.slice(5))))));
            document.body.className = 'view';
        } else {
            try {
                var content = decodeURIComponent(escape(RawDeflate.inflate(atob(h))));
                editor.setValue(content);
            } catch(e) {
                console.error('Failed to parse shared content:', e);
            }
        }
    } else if (localStorage.getItem('content')) {
        editor.setValue(localStorage.getItem('content'));
    }
    
    update(editor);
    editor.focus();
    updateStats();
    updateSaveStatus('Saved');
    
    document.getElementById('fileInput').addEventListener('change', openFile, false);
}

// Page leave warning
window.addEventListener("beforeunload", function (e) {
    if (!editor.getValue() || editor.getValue() == localStorage.getItem('content')) {
        return;
    }
    var confirmationMessage = 'You have unsaved changes. Are you sure you want to leave?';
    (e || window.event).returnValue = confirmationMessage;
    return confirmationMessage;
});

// Start
start();
