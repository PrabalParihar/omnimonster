"use client";

import React from 'react';

interface ChatInterfaceProps {
  [key: string]: any;
}

export function ChatInterface(props: ChatInterfaceProps) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Chat Interface</h3>
      <p className="text-sm text-gray-600">Component not yet implemented</p>
    </div>
  );
}

export default ChatInterface;