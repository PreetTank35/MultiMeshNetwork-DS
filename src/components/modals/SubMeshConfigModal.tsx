import React, { useState, useEffect } from 'react';
import { FrequencyBand, ProtocolType, SubMeshDomain } from '../../types/simulator';
import { X, Network, Radio, Shield, Palette, Layers } from 'lucide-react';

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
  { name: 'Electric Cyan', value: '#0891B2' },
  { name: 'Neon Purple', value: '#7C3AED' },
  { name: 'Coral Red', value: '#DC2626' },
];

const PROTOCOL_DETAILS: Record<ProtocolType, { title: string; desc: string; standard: string }> = {
  HWMP: { title: 'Hybrid Wireless Mesh', desc: 'IEEE 802.11s airtime metric & proactive tree / reactive route discovery.', standard: 'IEEE 802.11s' },
  RPL: { title: 'Routing Protocol for LLNs', desc: 'IPv6 gradient DAG routing tailored for constrained IoT sensors.', standard: 'RFC 6550' },
  AODV: { title: 'Ad hoc On-Demand Distance Vector', desc: 'On-demand reactive route discovery via RREQ and RREP flooding.', standard: 'RFC 3561' },
  OLSR: { title: 'Optimized Link State Routing', desc: 'Proactive topology broadcast minimized via Multipoint Relays (MPR).', standard: 'RFC 3626' },
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
  const [color, setColor] = useState<string>('#0891B2');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(`Sub-Mesh ${existingCount + 1} (${frequencyBand})`);
      setChannelNumber(DEFAULT_CHANNELS[frequencyBand][0] || 1);
      setColor(PRESET_COLORS[(existingCount + 2) % PRESET_COLORS.length].value);
    }
  }, [isOpen, existingCount]);

  const handleFrequencyChange = (band: FrequencyBand) => {
    setFrequencyBand(band);
    const channels = DEFAULT_CHANNELS[band];
    if (channels?.length) setChannelNumber(channels[0]);
    setChannelWidthMhz(band === '868MHz' || band === '915MHz' ? 0.25 : 20);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateSubMesh({
      id: `submesh_${Date.now().toString(36)}`,
      name: name.trim(),
      protocol,
      frequencyBand,
      channelNumber: Number(channelNumber),
      channelWidthMhz: Number(channelWidthMhz),
      color,
      description: description.trim() || `${protocol} mesh operating on ${frequencyBand} channel ${channelNumber}.`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-up" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 neu-convex text-neu-text flex flex-col gap-5 custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-neu-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl neu-pressed flex items-center justify-center text-sky-600 dark:text-cyan-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neu-text">Create Sub-Mesh Domain</h2>
              <p className="text-xs text-neu-muted">Define autonomous routing realm, RF band, and channel.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl neu-button-sm flex items-center justify-center text-neu-muted hover:text-neu-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted">Domain Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium neu-select focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-500" />
              Routing Protocol
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['HWMP', 'RPL', 'AODV', 'OLSR'] as ProtocolType[]).map(proto => {
                const isSel = protocol === proto;
                return (
                  <button
                    key={proto}
                    type="button"
                    onClick={() => setProtocol(proto)}
                    className={`p-2.5 rounded-2xl flex flex-col items-center gap-0.5 text-xs font-bold transition-all ${
                      isSel ? 'neu-pressed text-sky-600 dark:text-cyan-400' : 'neu-button-sm text-neu-muted hover:text-neu-text'
                    }`}
                  >
                    <span className="text-sm font-black">{proto}</span>
                    <span className="text-[9.5px] font-normal text-neu-muted">{PROTOCOL_DETAILS[proto].standard}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-neu-muted neu-pressed px-3 py-1.5 rounded-xl">
              <strong className="text-sky-600 dark:text-cyan-400">{protocol}: </strong>
              {PROTOCOL_DETAILS[protocol].desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-500" />
                Frequency Band
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['2.4GHz', '5.2GHz', '868MHz'] as FrequencyBand[]).map(band => {
                  const isSel = frequencyBand === band;
                  return (
                    <button
                      key={band}
                      type="button"
                      onClick={() => handleFrequencyChange(band)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        isSel ? 'neu-pressed text-amber-600 dark:text-amber-400' : 'neu-button-sm text-neu-muted hover:text-neu-text'
                      }`}
                    >
                      {band}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted">Operating Channel</label>
              <input
                type="number"
                min="1"
                max="200"
                value={channelNumber}
                onChange={e => setChannelNumber(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl text-sm font-mono neu-select focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-500" />
              Domain Color
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {PRESET_COLORS.map(c => {
                const isSel = color.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className="w-7 h-7 rounded-full transition-transform"
                    style={{
                      backgroundColor: c.value,
                      transform: isSel ? 'scale(1.2)' : 'scale(1.0)',
                      boxShadow: isSel ? `0 0 10px ${c.value}, inset 0 0 0 2px #fff` : '2px 2px 5px rgba(0,0,0,0.2)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neu-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold neu-button text-neu-muted hover:text-neu-text">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md transition-transform active:scale-95"
              style={{ backgroundColor: color }}
            >
              <Layers className="w-4 h-4" />
              Create Sub-Mesh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
