"use client";

import React, { useEffect, useState } from 'react';
import ServiceStatus from '@/components/ServiceStatus';
import { RefreshCcw, AlertTriangle, Calendar, Clock } from 'lucide-react';
import Image from 'next/image';
import DiscordBanner from '@/components/DiscordBanner';

interface Service {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'outage';
  latency: string;
}

interface MaintenanceData {
  active: boolean;
  status: 'under_maintenance' | 'operational';
  current: {
    active: boolean;
    title: string | null;
    message: string | null;
    started_at: string | null;
    estimated_end: string | null;
  } | null;
  scheduled: {
    has_scheduled: boolean;
    window: {
      id: string;
      title: string;
      message: string;
      start_time: string;
      end_time: string;
      affected_systems: string[];
      countdown_seconds: number;
    } | null;
  };
  timestamp: string;
}

const CAFFEINE_URL = (process.env.NEXT_PUBLIC_CAFFEINE_API_URL || 'https://caffeine.synqholdings.com').replace(/\/$/, '');

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([
    { id: 'api', name: 'Main API Gateway', description: 'Core infrastructure handling all requests', status: 'operational', latency: '0ms' },
    { id: 'web', name: 'Web Platform', description: 'Primary streaming interface (reelriot.app)', status: 'operational', latency: '0ms' },
  ]);
  const [maintenance, setMaintenance] = useState<MaintenanceData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [uptimeData, setUptimeData] = useState<{ date: string; uptime: number }[]>([]);
  const [providerData, setProviderData] = useState<Record<string, 'online' | 'degraded' | 'offline'>>({});
  const [circuitData, setCircuitData] = useState<Record<string, { state: string }>>({});
  const [providerCachedAt, setProviderCachedAt] = useState<string | null>(null);

  const checkStatus = async () => {
    // Single source of truth: Caffeine API handles all the heavy lifting
    try {
      const start = Date.now();
      const res = await fetch(`${CAFFEINE_URL}/status/health`, { cache: 'no-store' });
      const data = await res.json();
      const latency = Date.now() - start;
      
      const health = data.health || {};

      setServices([
        { 
          id: 'api', 
          name: 'Main API Gateway', 
          description: 'Core infrastructure handling all requests', 
          status: data.status === 'ok' ? 'operational' : 'outage',
          latency: `${latency}ms`
        },
        { 
          id: 'web', 
          name: 'Web Platform', 
          description: 'Primary streaming interface (reelriot.app)', 
          status: health.web?.status || 'degraded',
          latency: health.web?.latency || 'Error'
        }
      ]);

      if (health.providers && typeof health.providers === 'object') {
        setProviderData(health.providers);
        setProviderCachedAt(data.cached_at || null);
      }

      if (data.circuits && typeof data.circuits === 'object') {
        setCircuitData(data.circuits);
      }
    } catch {
      setServices(prev => prev.map(s => ({ ...s, status: 'outage', latency: 'Error' })));
    }

    setLastUpdated(new Date());
  };

  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`${CAFFEINE_URL}/status/maintenance`, { cache: 'no-store' });
      if (res.ok) {
        const data: MaintenanceData = await res.json();
        setMaintenance(data);
      }
    } catch (e) {
      console.warn('[Maintenance] Failed to fetch maintenance status:', e);
    }
  };

  const fetchUptime = async () => {
    try {
      const res = await fetch(`${CAFFEINE_URL}/status/uptime`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[Uptime] API returned HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setUptimeData(data);
      }
    } catch (e) {
      console.error("Failed to fetch uptime:", e);
    }
  };

  useEffect(() => {
    // Avoid calling setState synchronously during render phase
    const timer = setTimeout(() => {
      setMounted(true);
      checkStatus();
      fetchMaintenance();
      fetchUptime();
    }, 0);

    let statusInterval: ReturnType<typeof setInterval>;
    let maintenanceInterval: ReturnType<typeof setInterval>;
    let uptimeInterval: ReturnType<typeof setInterval>;

    const startIntervals = () => {
      stopIntervals();
      statusInterval = setInterval(checkStatus, 30000); // Check status every 30s
      maintenanceInterval = setInterval(fetchMaintenance, 15000); // Check maintenance every 15s
      uptimeInterval = setInterval(fetchUptime, 300000); // Check uptime every 5m
    };

    const stopIntervals = () => {
      if (statusInterval) clearInterval(statusInterval);
      if (maintenanceInterval) clearInterval(maintenanceInterval);
      if (uptimeInterval) clearInterval(uptimeInterval);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
        fetchMaintenance();
        fetchUptime();
        startIntervals();
      } else {
        stopIntervals();
      }
    };

    startIntervals();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      stopIntervals();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const isUnderMaintenance = maintenance?.active === true;
  const allOperational = services.every(s => s.status === 'operational');
  const anyOutage = services.some(s => s.status === 'outage');

  return (
    <main className="main-container">
      <div className="status-header">
        <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/logo.png" alt="Reelriot Logo" width={40} height={40} className="logo-img" />
          <h1>Reelriot <span style={{ color: '#8b5cf6' }}>Status</span></h1>
        </div>
        <div className={`global-status ${isUnderMaintenance ? 'status-degraded-bg' : (!allOperational ? (anyOutage ? 'status-outage-bg' : 'status-degraded-bg') : '')}`}>
          <div className={`pulse ${isUnderMaintenance ? 'pulse-warning' : (!allOperational ? 'pulse-warning' : '')}`} />
          <span>
            {isUnderMaintenance 
              ? 'System Maintenance Active' 
              : (allOperational ? 'All Systems Operational' : (anyOutage ? 'Major Service Outage' : 'Partial Service Disruption'))}
          </span>
        </div>
      </div>

      <div className="glass-card">
        {/* Active Maintenance Alert Banner */}
        {isUnderMaintenance && (
          <div 
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius)',
              background: 'var(--color-warning-surface)',
              border: '1px solid var(--color-warning-border)',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: 'var(--color-warning-default)', display: 'flex', alignItems: 'center' }}>
                  <AlertTriangle size={20} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-warning-lightest)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {maintenance.current?.title || 'Scheduled Maintenance in Progress'}
                </span>
              </div>
              {maintenance.current?.estimated_end && (
                <div style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '99px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: 'var(--color-warning-light)',
                  border: '1px solid var(--color-warning-border)'
                }}>
                  Estimated Return: {new Date(maintenance.current.estimated_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
              {maintenance.current?.message || 'We are currently upgrading core infrastructure. Streaming and API services will return shortly.'}
            </p>
          </div>
        )}

        {/* Upcoming Scheduled Maintenance Window */}
        {maintenance?.scheduled?.has_scheduled && maintenance.scheduled.window && (
          <div 
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius)',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calendar size={18} style={{ color: '#a78bfa' }} />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f5f3ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Upcoming Scheduled Maintenance
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#c4b5fd', fontWeight: 600 }}>
                {new Date(maintenance.scheduled.window.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(maintenance.scheduled.window.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(maintenance.scheduled.window.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                {maintenance.scheduled.window.title}
              </span>
              <p style={{ fontSize: '0.85rem', color: '#d4d4d8', lineHeight: 1.5 }}>
                {maintenance.scheduled.window.message}
              </p>
            </div>
            {maintenance.scheduled.window.affected_systems?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase' }}>Scope:</span>
                {maintenance.scheduled.window.affected_systems.map(sys => (
                  <span 
                    key={sys}
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.375rem',
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: '#ddd6fe',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    {sys}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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
            {Object.entries(providerData || {}).map(([id, status]) => (
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
          </div>
        </div>

        <div className="circuits-section" style={{ marginTop: '4rem' }}>
          <div className="section-title">Circuit Breakers (Fail-safe)</div>
          <p style={{ color: '#71717a', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '600px' }}>
            Our infrastructure automatically throttles connections to external AI and search APIs if they become slow or rate-limited to maintain core system stability.
          </p>
          <div className="provider-grid">
            {Object.entries(circuitData || {}).map(([id, info]) => {
              const state = info?.state || 'UNKNOWN';
              return (
                <div key={id} className="provider-card" style={{ border: state === 'OPEN' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="provider-meta">
                    <span className="provider-name" style={{ fontSize: '0.8rem' }}>{id}</span>
                    <span className={`provider-dot status-${state === 'CLOSED' ? 'operational' : (state === 'OPEN' ? 'outage' : 'degraded')}`} />
                  </div>
                  <span className={`provider-status status-${state === 'CLOSED' ? 'operational' : (state === 'OPEN' ? 'outage' : 'degraded')}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {state}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="uptime-section" style={{ marginTop: '4rem' }}>
          <div className="section-title">System Uptime (90 Days)</div>
          <div className="uptime-container">
            <div className="uptime-bars">
              {uptimeData.length > 0 ? (
                uptimeData.map((day) => (
                  <div 
                    key={day.date} 
                    className="uptime-bar"
                    title={`${day.date}: ${(day.uptime * 100).toFixed(1)}%`}
                    style={{
                      height: '32px',
                      background: day.uptime >= 0.99 ? 'var(--color-success-default)' : (day.uptime >= 0.95 ? 'var(--color-warning-default)' : 'var(--color-danger-default)'),
                      opacity: mounted ? 1 : 0,
                      transition: 'opacity 0.2s ease-in'
                    }}
                  />
                ))
              ) : (
                Array.from({ length: 90 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="uptime-bar"
                    style={{
                      height: '32px',
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  />
                ))
              )}
            </div>
            <div className="uptime-labels">
              <span>90 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
