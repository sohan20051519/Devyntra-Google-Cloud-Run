import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../icons/Icons';

interface TerminalLine {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface TerminalProps {
  logs: TerminalLine[];
  isActive: boolean;
  className?: string;
}

const Terminal: React.FC<TerminalProps> = ({ logs, isActive, className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const getTypeIcon = (type: TerminalLine['type']) => {
    switch (type) {
      case 'success':
        return <Icons.CheckCircle size={14} className="text-green-500" />;
      case 'error':
        return <Icons.XCircle size={14} className="text-red-500" />;
      case 'warning':
        return <Icons.XCircle size={14} className="text-yellow-500" />;
      default:
        return <Icons.CheckCircle size={14} className="text-blue-500" />;
    }
  };

  const getTypeColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 overflow-hidden ${className}`}>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300 text-sm font-medium ml-2">Deployment Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              LIVE
            </div>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      {!isMinimized && (
        <div
          ref={terminalRef}
          className="h-96 overflow-y-auto p-4 font-mono text-sm bg-gray-900 no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">
              <span className="text-green-400">$</span> Waiting for deployment to start...
            </div>
          ) : (
            logs.map((line) => (
              <div key={line.id} className="flex items-start gap-2 mb-1">
                <span className="text-gray-500 text-xs mt-0.5 min-w-[60px]">
                  {line.timestamp}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  {getTypeIcon(line.type)}
                  <span className={`${getTypeColor(line.type)} flex-1`}>
                    {line.message}
                  </span>
                </div>
              </div>
            ))
          )}
          {isActive && logs.length > 0 && (
            <div className="flex items-center gap-2 text-green-400">
              <span className="text-green-400">$</span>
              <div className="w-2 h-4 bg-green-400 animate-pulse"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Terminal;
