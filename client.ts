/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

/// <reference path="./node_modules/xterm/typings/xterm.d.ts"/>

import { Terminal } from './node_modules/xterm/lib/public/Terminal';
import * as attach from './node_modules/xterm/lib/addons/attach/attach';
import * as fit from './node_modules/xterm/lib/addons/fit/fit';
import * as fullscreen from './node_modules/xterm/lib/addons/fullscreen/fullscreen';
import * as search from './node_modules/xterm/lib/addons/search/search';
import * as webLinks from './node_modules/xterm/lib/addons/webLinks/webLinks';
import * as winptyCompat from './node_modules/xterm/lib/addons/winptyCompat/winptyCompat';

// Pulling in the module's types relies on the <reference> above, it's looks a
// little weird here as we're importing "this" module
import { Terminal as TerminalType } from 'xterm';

export interface IWindowWithTerminal extends Window {
  term: TerminalType;
}
declare let window: IWindowWithTerminal;

Terminal.applyAddon(attach);
Terminal.applyAddon(fit);
Terminal.applyAddon(fullscreen);
Terminal.applyAddon(search);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(winptyCompat);


let term;
let protocol;
let socketURL;
let socket;
let pid;

const terminalContainer = document.getElementById('terminal-container');

createTerminal();

function createTerminal(): void {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({});
  window.term = term;  // Expose `term` to window for debugging purposes
  term.on('resize', (size: { cols: number, rows: number }) => {
    if (!pid) {
      return;
    }
    const cols = size.cols;
    const rows = size.rows;
    const url = '/console/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/console/terminals/';

  term.open(terminalContainer);
  term.winptyCompatInit();
  term.webLinksInit();
  console.log("width = " + terminalContainer.style.width);
  console.log("height = " + terminalContainer.style.height);
  term.fit();
  term.focus();


  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(() => {
    initOptions(term);

    // Set terminal size again to set the specific dimensions on the demo
    updateTerminalSize();

    fetch('/console/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then((res) => {
      res.text().then((processId) => {
        pid = processId;
        socketURL += processId;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;
      });
    });
  }, 0);
}

function runRealTerminal(): void {
  term.attach(socket);
  term._initialized = true;
}

function runFakeTerminal(): void {
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  term.prompt = () => {
    term.write('\r\n$ ');
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term._core.register(term.addDisposableListener('key', (key, ev) => {
    const printable = !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey;

    if (ev.keyCode === 13) {
      term.prompt();
    } else if (ev.keyCode === 8) {
     // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(key);
    }
  }));

  term._core.register(term.addDisposableListener('paste', (data, ev) => {
    term.write(data);
  }));
}

function initOptions(term: TerminalType): void {
  const blacklistedOptions = [
    // Internal only options
    'cancelEvents',
    'convertEol',
    'debug',
    'handler',
    'screenKeys',
    'termName',
    'useFlowControl',
    // Complex option
    'theme'
  ];
  const stringOptions = {
    bellSound: null,
    bellStyle: ['none', 'sound'],
    cursorStyle: ['block', 'underline', 'bar'],
    experimentalCharAtlas: ['none', 'static', 'dynamic'],
    fontFamily: null,
    fontWeight: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    fontWeightBold: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    rendererType: ['dom', 'canvas'],
    //experimentalBufferLineImpl: ['JsArray', 'TypedArray']
  };
  const options = Object.keys((<any>term)._core.options);
  const booleanOptions = [];
  const numberOptions = [];
  options.filter(o => blacklistedOptions.indexOf(o) === -1).forEach(o => {
    switch (typeof term.getOption(o)) {
      case 'boolean':
        booleanOptions.push(o);
        break;
      case 'number':
        numberOptions.push(o);
        break;
      default:
        if (Object.keys(stringOptions).indexOf(o) === -1) {
          console.warn(`Unrecognized option: "${o}"`);
        }
    }
  });


}

terminalContainer.addEventListener("resize", updateTerminalSize);

function updateTerminalSize(): void {
  terminalContainer.style.width = (terminalContainer.clientWidth - term._core.viewport.scrollBarWidth).toString()+"px";
  terminalContainer.style.height = (terminalContainer.clientHeight - 20).toString()+"px";
  term.fit();
}
