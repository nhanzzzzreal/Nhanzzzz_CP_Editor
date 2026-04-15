import React, { useEffect, useRef, useMemo, useState, useCallback, RefObject } from 'react';
import { Terminal as TerminalIcon, ClipboardCopy, Trash2 } from 'lucide-react';
import { Xterm } from 'xterm-react';
import { ITerminalOptions, Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// VSCode-like theme for xterm
const terminalOptions: ITerminalOptions = {
  cursorBlink: true,
  convertEol: true, // Important for Windows
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 13,
  theme: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#cccccc',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#3b8eea',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
  scrollback: 2000,
  disableStdin: true,
};

export const Terminal = ({ logs, onClear }: { logs: string[], onClear: () => void }) => {
  const termRef: RefObject<XtermTerminal> = useRef<XtermTerminal>(null);
  const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(0);
  const [filter, setFilter] = useState('');

  // Memoize fitAddon to prevent re-creation on every render
  
  const fitAddon = useMemo(() => new FitAddon(), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const fit = () => {
      try {
        fitAddon.fit();
      } catch(e) {
        // Safe to ignore
      }
    }
    
    const timeoutId = setTimeout(fit, 1);
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [fitAddon]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    if (logs.length === 0 && prevLogsLengthRef.current > 0) {
      term.clear();
      term.writeln('\x1b[3m\x1b[90mNo output yet...\x1b[0m');
    } 
    else if (logs.length > prevLogsLengthRef.current) {
      if (prevLogsLengthRef.current === 0 && logs.length > 0) {
        term.clear();
      }
      const newLogs = logs.slice(prevLogsLengthRef.current);
      newLogs.forEach(log => {
        const formattedLog = log.replace(/\r?\n/g, '\r\n');
        term.writeln(formattedLog);
      });
    }

    prevLogsLengthRef.current = logs.length;
    term.scrollToBottom();

  }, [logs]);

  useEffect(() => {
    const term = termRef.current;
    if (term && logs.length === 0) {
        setTimeout(() => {
            term.clear();
            term.writeln('\x1b[3m\x1b[90mNo output yet...\x1b[0m');
        }, 50);
    }
  }, [logs.length]); // Added logs.length to dependency array to satisfy React rules if needed, otherwise [] is fine.

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(logs.join('\n'));
  }, [logs]);

  const handleTerminalInit = (terminal: XtermTerminal) => {
    termRef.current = terminal;
    fitAddon.activate(terminal); // Activate fit addon here
    terminal.writeln('\x1b[3m\x1b[90mNo output yet...\x1b[0m'); // Initial message
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-[#333] shrink-0">
        <div className="flex items-center gap-2">
            <TerminalIcon size={14} />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Filter logs..." value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-[#252526] border border-[#3c3c3c] rounded px-2 py-0.5 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={copyToClipboard} className="p-1.5 rounded hover:bg-[#333] text-gray-400" title="Copy All Logs"><ClipboardCopy size={14} /></button>
          <button onClick={onClear} className="p-1.5 rounded hover:bg-[#333] text-red-500/80" title="Clear Terminal"><Trash2 size={14} /></button>
        </div>
      </header>
      <div ref={containerRef} className="flex-1 p-3 pt-1 overflow-hidden">
        {/* Xterm component will render the logs */}
        <Xterm
          className="h-full"
          onInit={handleTerminalInit}
          options={terminalOptions}
          addons={[fitAddon]}
        />
      </div>
    </div>
  );
};