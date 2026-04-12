import React, { useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
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
  // Cập nhật Type cho termRef sử dụng XtermTerminal
  const termRef = useRef<XtermTerminal | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(0);
  
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
        const timestamp = `[${new Date().toLocaleTimeString([], { hour12: false })}]`;
        const formattedLog = log.replace(/\r?\n/g, '\r\n');
        term.writeln(`\x1b[34m${timestamp}\x1b[0m ${formattedLog}`);
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

  // Cập nhật Type cho tham số
  const handleTerminalInit = (terminal: XtermTerminal) => {
    termRef.current = terminal;
  };

  return (
    <div className="h-full bg-[#1e1e1e] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#252526] border-b border-[#333]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 uppercase font-bold tracking-wider">
            <TerminalIcon size={14} />
            Terminal
          </div>
          <button
            onClick={onClear}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors uppercase font-bold tracking-wider"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 p-3 pt-1 overflow-hidden">
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