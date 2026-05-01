import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ServiceStatusProps {
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'outage';
  latency?: string;
}

export default function ServiceStatus({ name, description, status, latency }: ServiceStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'operational': return <CheckCircle2 className="w-5 h-5" />;
      case 'degraded': return <AlertCircle className="w-5 h-5" />;
      case 'outage': return <XCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="service-item">
      <div className="service-info">
        <h3>{name}</h3>
        <p>{description} {latency && `• ${latency}`}</p>
      </div>
      <div className={`status-badge status-${status}`}>
        {getStatusIcon()}
        <span>{status}</span>
      </div>
    </div>
  );
}
