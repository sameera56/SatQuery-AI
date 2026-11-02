'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

const CREDENTIAL_KEY = 'satquery-biometric-credential';
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
};

export default function BiometricAccessPanel() {
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking device support…');

  useEffect(() => {
    const ready = typeof window !== 'undefined' && window.isSecureContext && 'credentials' in navigator && 'PublicKeyCredential' in window;
    const saved = localStorage.getItem(CREDENTIAL_KEY);
    setSupported(ready); setEnrolled(Boolean(saved));
    setMessage(ready ? (saved ? 'Device credential enrolled. Verify to unlock.' : 'Enroll this device using its built-in biometric prompt.') : 'Biometric access needs HTTPS or localhost and a compatible device.');
  }, []);

  const enroll = async () => {
    if (!supported) return;
    setBusy(true); setMessage('Waiting for your device biometric confirmation…');
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          // Omitting rp.id lets the browser bind the credential to the current
          // origin. This is more compatible with localhost and 127.0.0.1,
          // where some platform authenticators reject an explicit IP rp.id.
          rp: { name: 'SATQUERY AI' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'local-operator', displayName: 'Local Operator' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
          timeout: 60_000,
          attestation: 'none',
        },
      }) as PublicKeyCredential | null;
      if (!credential) throw new Error('No credential was created.');
      localStorage.setItem(CREDENTIAL_KEY, toBase64Url(new Uint8Array(credential.rawId)));
      setEnrolled(true); setUnlocked(true); setMessage('Biometric device access enrolled and unlocked.');
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'NotAllowedError' ? 'Biometric request was cancelled or unavailable.' : 'Could not enroll this device.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    const saved = localStorage.getItem(CREDENTIAL_KEY);
    if (!supported || !saved) return;
    setBusy(true); setMessage('Verify with your device biometrics…');
    try {
      const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: fromBase64Url(saved) }], userVerification: 'required', timeout: 60_000 } });
      if (!assertion) throw new Error('No biometric assertion returned.');
      setUnlocked(true); setMessage('Biometric verification completed for this device.');
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'NotAllowedError' ? 'Verification was cancelled or did not complete.' : 'Could not verify this device.');
    } finally { setBusy(false); }
  };

  return <div className="glass-panel overflow-hidden bg-[#0a0b10]/95">
    <div className="px-3 py-2.5 border-b border-cyan-300/15 bg-cyan-300/[0.06] flex items-center gap-2"><Fingerprint className="w-4 h-4 text-cyan-300" /><div><p className="text-[11px] font-mono font-bold tracking-wider text-white">BIOMETRIC ACCESS</p><p className="text-[9px] font-mono text-cyan-200/70">DEVICE-LOCAL WEBAUTHN</p></div></div>
    <div className="p-3 space-y-3">
      <div className="flex gap-2 text-[10px] font-mono leading-relaxed text-white/65"><ShieldCheck className="w-4 h-4 shrink-0 text-cyan-300" />{message}</div>
      <div className="flex items-center gap-2 text-[9px] font-mono text-white/45"><span className={`w-1.5 h-1.5 rounded-full ${supported ? 'bg-emerald-400' : 'bg-red-400'}`} />{supported ? 'WEBAUTHN AVAILABLE' : 'WEBAUTHN UNAVAILABLE'}{enrolled && <><span className="text-white/20">|</span><KeyRound className="w-3 h-3 text-cyan-300" />ENROLLED</>}{unlocked && <><span className="text-white/20">|</span><CheckCircle2 className="w-3 h-3 text-emerald-400" />UNLOCKED</>}</div>
      <button disabled={!supported || busy} onClick={enrolled ? verify : enroll} className="w-full py-2 rounded border border-cyan-300/30 bg-cyan-300/10 hover:bg-cyan-300/20 disabled:opacity-40 text-[10px] font-mono font-bold tracking-widest text-cyan-100 transition-colors flex justify-center items-center gap-2"><Fingerprint className="w-4 h-4" />{busy ? 'WAITING FOR DEVICE…' : enrolled ? 'VERIFY WITH BIOMETRICS' : 'ENROLL BIOMETRIC ACCESS'}</button>
      <div className="border-t border-white/5 pt-2 flex gap-1.5 text-[8px] leading-relaxed font-mono text-white/40"><LockKeyhole className="w-3 h-3 shrink-0 mt-0.5" />Uses your device&apos;s Face ID, fingerprint, or Windows Hello. No biometric image or fingerprint data is collected by SATQUERY AI. This local unlock is not a server-verified user account.</div>
    </div>
  </div>;
}
