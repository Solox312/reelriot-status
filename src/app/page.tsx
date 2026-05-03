"use client";

import React, { useEffect, useState } from 'react';
import ServiceStatus from '@/components/ServiceStatus';
import { ShieldCheck, RefreshCcw } from 'lucide-react';
import Image from 'next/image';
import DiscordBanner from '@/components/DiscordBanner';

interface Service {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'outage';
  latency: string;
}

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([
    { id: 'api', name: 'Main API Gateway', description: 'Core infrastructure handling all requests', status: 'operational', latency: '0ms' },
    { id: 'web', name: 'Web Platform', description: 'Primary streaming interface (reelriot.app)', status: 'operational', latency: '0ms' },
    { id: 'cdn', name: 'Cloudflare CDN Proxy', description: 'Global content delivery and proxying', status: 'operational', latency: '0ms' },
  ]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [uptimeData, setUptimeData] = useState<{ date: string; uptime: number }[]>([]);
  const [providerData, setProviderData] = useState<Record<string, 'online' | 'degraded' | 'offline'>>({});
  const [providerCachedAt, setProviderCachedAt] = useState<string | null>(null);

  const checkStatus = async () => {
    // Single source of truth: Caffeine API handles all the heavy lifting
    try {
      const start = Date.now();
      const res = await fetch('https://caffeine.synqholdings.com/status', { cache: 'no-store' });
      const data = await res.json();
      const latency = Date.now() - start;
      
      const health = data.health || {};

      setServices([
        { 
          id: 'api', 
          name: 'Main API Gateway', 
          description: 'Core infrastructure handling all requests', 
          status: res.ok ? 'operational' : 'degraded',
          latency: `${latency}ms`
        },
        { 
          id: 'web', 
          name: 'Web Platform', 
          description: 'Primary streaming interface (reelriot.app)', 
          status: health.web?.status || 'degraded',
          latency: health.web?.latency || 'Error'
        },
        { 
          id: 'cdn', 
          name: 'Cloudflare CDN Proxy', 
          description: 'Global content delivery and proxying', 
          status: health.cdn?.status || 'degraded',
          latency: health.cdn?.latency || 'Error'
        }
      ]);

      if (health.providers) {
        setProviderData(health.providers);
        setProviderCachedAt(data.cached_at);
      }
    } catch (e) {
      setServices(prev => prev.map(s => ({ ...s, status: 'outage', latency: 'Error' })));
    }

    setLastUpdated(new Date());
  };

  const fetchUptime = async () => {
    try {
      const res = await fetch('https://caffeine.synqholdings.com/status/uptime', { cache: 'no-store' });
      const data = await res.json();
      setUptimeData(data);
    } catch (e) {
      console.error("Failed to fetch uptime:", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    checkStatus();
    fetchUptime();
    const statusInterval = setInterval(checkStatus, 30000); // Check status every 30s
    const uptimeInterval = setInterval(fetchUptime, 300000); // Check uptime every 5m
    return () => {
      clearInterval(statusInterval);
      clearInterval(uptimeInterval);
    };
  }, []);

  const allOperational = services.every(s => s.status === 'operational');
  const anyOutage = services.some(s => s.status === 'outage');

  return (
    <main className="main-container">
      <div className="status-header">
        <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/logo.png" alt="Reelriot Logo" width={40} height={40} className="logo-img" />
          <h1>Reelriot <span style={{ color: '#8b5cf6' }}>Status</span></h1>
        </div>
        <div className={`global-status ${!allOperational ? (anyOutage ? 'status-outage-bg' : 'status-degraded-bg') : ''}`}>
          <div className={`pulse ${!allOperational ? 'pulse-warning' : ''}`} />
          <span>{allOperational ? 'All Systems Operational' : (anyOutage ? 'Major Service Outage' : 'Partial Service Disruption')}</span>
        </div>
      </div>

      <div className="glass-card">
        <div className="section-title">Current Services</div>
        <div className="service-grid">
          {services.map(service => (
            <ServiceStatus 
              key={service.id}
              name={service.name}
              description={service.description}
              status={service.status}
              latency={service.latency}
            />
          ))}
        </div>

        <DiscordBanner />

        <div className="provider-section" style={{ marginTop: '4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Content Providers</div>
            {providerCachedAt && (
              <span style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Last verified: {new Date(providerCachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="provider-grid">
            {Object.entries(providerData).map(([id, status]) => (
              <div key={id} className="provider-card">
                <div className="provider-meta">
                  <span className="provider-name" style={{ textTransform: 'capitalize' }}>{id}</span>
                  <span className={`provider-dot status-${status === 'online' ? 'operational' : status}`} />
                </div>
                <span className={`provider-status status-${status === 'online' ? 'operational' : status}`} style={{ textTransform: 'uppercase' }}>
                  {status}
                </span>
              </div>
            ))}
            {Object.keys(providerData).length === 0 && (
              <div className="service-info" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                <p>Loading provider health data...</p>
              </div>
            )}
          </div>
        </div>
 
        <div className="uptime-history">
          <div className="section-title">Uptime History (Last 90 Days)</div>
          <div className="uptime-bars">
            {uptimeData.map((day, i) => (
              <div 
                key={i} 
                className={`uptime-bar ${day.uptime === 0 ? 'status-outage' : (day.uptime < 0.9 ? 'status-degraded' : '')}`}
                style={{ opacity: mounted ? (day.uptime === 0 ? 1 : day.uptime) : 0.2 }} 
                title={`${day.date}: ${Math.round(day.uptime * 100)}% uptime`}
              />
            ))}
            {uptimeData.length === 0 && Array.from({ length: 90 }).map((_, i) => (
               <div key={i} className="uptime-bar" style={{ opacity: 0.1 }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold' }}>
            <span>90 days ago</span>
            <span>{uptimeData.length > 0 ? (uptimeData.reduce((acc, d) => acc + d.uptime, 0) / uptimeData.length > 0.99 ? '99.9% Uptime' : 'System Operational') : 'Loading history...'}</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      <div className="footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <RefreshCcw className="w-3 h-3" />
          <p>
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting...'} 
            <span className="dot-divider" /> 
            Auto-refreshing every 30s
          </p>
        </div>
        <p>&copy; 2026 Reelriot. Back to <a href="https://reelriot.app">reelriot.app</a></p>
      </div>
    </main>
  );
}
