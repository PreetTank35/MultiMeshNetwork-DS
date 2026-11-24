/**
 * SubMeshConfigModal — Neomorphic Sub-Mesh Domain Configuration Modal
 * Allows operators to dynamically instantiate and calibrate new RF domains.
 */

import React, { useState, useEffect } from 'react';
import { FrequencyBand, ProtocolType, SubMeshDomain } from '../../types/simulator';
import { X, Network, Radio, Shield, Palette, Layers, Info } from 'lucide-react';

interface SubMeshConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSubMesh: (domain: SubMeshDomain) => void;
  existingCount?: number;
}

const PRESET_COLORS = [
  { name: 'Cobalt Blue', value: '#2563EB' },
  { name: 'Cyber Green', value: '#059669' },
  { name: 'Amber Gold', value: '#D97706' },
  { name: 'Electric Cyan', value: '#06B6D4' },
  { name: 'Neon Purple', value: '#8B5CF6' },
  { name: 'Coral Red', value: '#DC2626' },
  { name: 'Teal Mint', value: '#0D9488' },
  { name: 'Rose Pink', value: '#E11D48' },
];

const PROTOCOL_DETAILS: Record<ProtocolType, { title: string; desc: string; standard: string }> = {
  HWMP: {
    title: 'Hybrid Wireless Mesh',
    desc: 'IEEE 802.11s airtime metric & proactive tree / reactive route discovery.',
    standard: 'IEEE 802.11s',
  },
  RPL: {
    title: 'Routing Protocol for LLNs',
    desc: 'IPv6 gradient DAG routing tailored for memory-constrained IoT sensors.',
    standard: 'RFC 6550',
  },
  AODV: {
    title: 'Ad hoc On-Demand Distance Vector',
    desc: 'On-demand reactive route discovery via RREQ and RREP flooding.',
    standard: 'RFC 3561',
  },
  OLSR: {
    title: 'Optimized Link State Routing',
    desc: 'Proactive topology broadcast minimized via Multipoint Relays (MPR).',
    standard: 'RFC 3626',
  },
};

const DEFAULT_CHANNELS: Record<FrequencyBand, number[]> = {
  '2.4GHz': [1, 6, 11],
  '5.2GHz': [36, 40, 44, 48],
  '5.8GHz': [149, 153, 157, 161],
  '868MHz': [1, 2, 3],
  '915MHz': [1, 5, 10],
};

export const SubMeshConfigModal: React.FC<SubMeshConfigModalProps> = ({
  isOpen,
  onClose,
  onCreateSubMesh,
  existingCount = 2,
}) => {
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ProtocolType>('HWMP');
  const [frequencyBand, setFrequencyBand] = useState<FrequencyBand>('2.4GHz');
  const [channelNumber, setChannelNumber] = useState<number>(6);
  const [channelWidthMhz, setChannelWidthMhz] = useState<number>(20);
  const [color, setColor] = useState<string>('#06B6D4');
  const [description, setDescription] = useState('');

  // Reset defaults when opening
  useEffect(() => {
    if (isOpen) {
      const nextId = existingCount + 1;
      setName(`Sub-Mesh ${nextId} (${frequencyBand})`);
      setChannelNumber(DEFAULT_CHANNELS[frequencyBand][0] || 1);
      setColor(PRESET_COLORS[(existingCount + 2) % PRESET_COLORS.length].value);
    }
  }, [isOpen, existingCount]);

  // Update default channel when band changes
  const handleFrequencyChange = (band: FrequencyBand) => {
    setFrequencyBand(band);
    const channels = DEFAULT_CHANNELS[band];
    if (channels && channels.length > 0) {
      setChannelNumber(channels[0]);
    }
    if (band === '868MHz' || band === '915MHz') {
      setChannelWidthMhz(0.25); // LoRa / Zigbee narrow band
    } else {
      setChannelWidthMhz(20);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = `submesh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newSubMesh: SubMeshDomain = {
      id,
      name: name.trim(),
      protocol,
      frequencyBand,
      channelNumber: Number(channelNumber),
      channelWidthMhz: Number(channelWidthMhz),
      color,
      description: description.trim() || `${protocol} mesh operating on ${frequencyBand} channel ${channelNumber}.`,
    };

    onCreateSubMesh(newSubMesh);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 text-slate-100 border border-slate-700/50 flex flex-col gap-6"
        style={{
          background: '#161B26',
          boxShadow: '12px 12px 32px #0c0f16, -12px -12px 32px #202736',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-cyan-400"
              style={{
                background: '#131822',
                boxShadow: 'inset 2px 2px 5px #0a0c12, inset -2px -2px 5px #1c2432',
              }}
            >
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Configure New Sub-Mesh Domain
              </h2>
              <p className="text-xs text-slate-400">
                Define autonomous routing realm, radio frequency, and spectrum channels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{
              background: '#161B26',
              boxShadow: '3px 3px 6px #0e1118, -3px -3px 6px #1e2534',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Domain Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Domain Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5.2GHz Lab Backbone or 868MHz Sensor Mesh"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-slate-700/40"
              style={{
                background: '#121620',
                boxShadow: 'inset 3px 3px 6px #090c12, inset -3px -3px 6px #1b2130',
              }}
            />
          </div>

          {/* Protocol Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              Routing Protocol
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(['HWMP', 'RPL', 'AODV', 'OLSR'] as ProtocolType[]).map((proto) => {
                const isSelected = protocol === proto;
                return (
                  <button
                    key={proto}
                    type="button"
                    onClick={() => setProtocol(proto)}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all text-xs font-bold ${
                      isSelected
                        ? 'text-cyan-400 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    style={{
                      background: isSelected ? '#121622' : '#161B26',
                      boxShadow: isSelected
                        ? 'inset 3px 3px 6px #090c13, inset -3px -3px 6px #1c2233'
                        : '4px 4px 8px #0f121a, -4px -4px 8px #1d2432',
                    }}
                  >
                    <span className="text-sm font-black">{proto}</span>
                    <span className="text-[10px] font-normal text-slate-400 line-clamp-1">
                      {PROTOCOL_DETAILS[proto].standard}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-cyan-400 font-semibold">{protocol}: </span>
              {PROTOCOL_DETAILS[protocol].desc}
            </p>
          </div>

          {/* Radio Frequency Band & Channel Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Frequency Band */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                Frequency Band
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['2.4GHz', '5.2GHz', '868MHz'] as FrequencyBand[]).map((band) => {
                  const isSelected = frequencyBand === band;
                  return (
                    <button
                      key={band}
                      type="button"
                      onClick={() => handleFrequencyChange(band)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'text-amber-400 border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                      style={{
                        background: isSelected ? '#121620' : '#161B26',
                        boxShadow: isSelected
                          ? 'inset 2px 2px 5px #090c12, inset -2px -2px 5px #1b2130'
                          : '3px 3px 6px #0f121a, -3px -3px 6px #1d2432',
                      }}
                    >
                      {band}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Operating Channel
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={channelNumber}
                  onChange={(e) => setChannelNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl text-sm font-medium text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 border border-slate-700/40"
                  style={{
                    background: '#121620',
                    boxShadow: 'inset 2px 2px 5px #090c12, inset -2px -2px 5px #1b2130',
                  }}
                />
                {/* Channel Quick Presets */}
                <div className="flex items-center gap-1">
                  {(DEFAULT_CHANNELS[frequencyBand] || [1, 6, 11]).slice(0, 3).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannelNumber(ch)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold ${
                        channelNumber === ch ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Ch{ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Channel Bandwidth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Channel Bandwidth
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '250 kHz', val: 0.25 },
                { label: '20 MHz', val: 20 },
                { label: '40 MHz', val: 40 },
                { label: '80 MHz', val: 80 },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChannelWidthMhz(val)}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    channelWidthMhz === val
                      ? 'text-cyan-400 border border-cyan-500/40 bg-[#121620]'
                      : 'text-slate-400 border border-slate-800'
                  }`}
                  style={{
                    boxShadow: channelWidthMhz === val
                      ? 'inset 2px 2px 4px #090c12, inset -2px -2px 4px #1b2130'
                      : '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              Domain Visual Identification Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => {
                const isSelected = color.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className="w-8 h-8 rounded-full transition-transform flex items-center justify-center relative"
                    style={{
                      backgroundColor: c.value,
                      boxShadow: isSelected
                        ? `0 0 12px ${c.value}, inset 0 0 0 2px #FFFFFF`
                        : '2px 2px 5px #0a0d14',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1.0)',
                    }}
                  />
                );
              })}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-slate-400">Hex:</span>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 px-2 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-center font-mono"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Domain Description & Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Environmental sensor network for solar microgrid telemetry"
              className="w-full px-4 py-2 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-slate-700/40"
              style={{
                background: '#121620',
                boxShadow: 'inset 2px 2px 5px #090c12, inset -2px -2px 5px #1b2130',
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              style={{
                background: '#161B26',
                boxShadow: '4px 4px 8px #0f121a, -4px -4px 8px #1d2432',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-transform active:scale-95 flex items-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${color}CC, ${color})`,
                boxShadow: `0 4px 16px ${color}55, 4px 4px 8px #0f121a`,
              }}
            >
              <Layers className="w-4 h-4" />
              Create Sub-Mesh Domain
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
