import React from 'react';

const TrafficBar = ({ level }: { level: number }) => {
  const getColor = (l: number) => {
    if (l < 33) return 'bg-green-500';
    if (l < 66) return 'bg-blue-500';
    return 'bg-red-500';
  };
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${getColor(level)}`} style={{ width: `${level}%` }} />
    </div>
  );
};

export default TrafficBar;
