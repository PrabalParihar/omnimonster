"use client";

import React from 'react';

interface ManualClaimProps {
  [key: string]: any;
}

export function ManualClaim(props: ManualClaimProps) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Manual Claim</h3>
      <p className="text-sm text-gray-600">Component not yet implemented</p>
    </div>
  );
}

export default ManualClaim;