'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X } from 'lucide-react';
import { ticketIdFrom } from '../../../lib/ticketId';

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

/** Chrome on Android has a built-in, fast decoder; Safari does not, so it falls back to jsQR. */
async function makeDetector(): Promise<Detect> {
  const Native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(s: CanvasImageSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const detector = new Native({ formats: ['qr_code'] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    } catch {
      // Unsupported format on this device: use jsQR below.
    }
  }
  const jsQR = (await import('jsqr')).default;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    // Decoding a downscaled frame is much faster and still reads a phone-sized QR code.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'Could not start the camera. Use the search below instead.';
}

/** Opens the phone's back camera (or the laptop webcam) and jumps to that runner's check-in page as soon as a ticket QR is read. */
export function QrScanner({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const [state, setState] = useState<'idle' | 'starting' | 'scanning' | 'found'>('idle');
  const [message, setMessage] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  // Front cameras (laptop webcams) are shown mirrored so holding up a ticket feels natural.
  // Only the preview is flipped; the decoder reads the raw frames.
  const [mirrored, setMirrored] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    stop();
    setMessage('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('The camera only works when this site is opened over https://. Use the search below instead.');
      return;
    }
    setState('starting');
    try {
      const camera = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { ...camera, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const settings = stream.current.getVideoTracks()[0]?.getSettings() ?? {};
      setMirrored(settings.facingMode !== 'environment');
      setCameraId(settings.deviceId ?? '');
      // Device labels are only filled in once camera permission is granted, so list them now.
      setCameras((await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput'));
      const element = video.current!;
      element.srcObject = stream.current;
      await element.play();
      const detect = await makeDetector();
      setState('scanning');

      let busy = false;
      let lastWrong = '';
      const tick = async () => {
        frame.current = requestAnimationFrame(tick);
        if (busy || element.readyState < element.HAVE_ENOUGH_DATA) return;
        busy = true;
        try {
          const text = await detect(element);
          if (!text) return;
          const id = ticketIdFrom(text);
          if (id) {
            stop();
            setState('found');
            navigator.vibrate?.(80);
            router.push(`/admin/checkin/${id}`);
          } else if (text !== lastWrong) {
            lastWrong = text;
            setMessage('That QR code is not a One Indore Run Indore ticket.');
          }
        } catch {
          // A frame that fails to decode is normal; try the next one.
        } finally {
          busy = false;
        }
      };
      tick();
    } catch (error) {
      stop();
      setState('idle');
      setMessage(cameraError(error));
    }
  }, [router, stop]);

  const close = () => {
    stop();
    setState('idle');
    setMessage('');
  };

  useEffect(() => {
    if (autoStart) start();
    return stop;
  }, [autoStart, start, stop]);

  const open = state !== 'idle';
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="qrScanner">
      <div className={open ? 'qrViewport' : 'qrViewport hidden'}>
        <video ref={video} className={mirrored ? 'mirrored' : undefined} muted playsInline aria-label="Camera preview" />
        <span className="qrFrame" aria-hidden="true" />
        <p className="qrStatus" role="status">
          {state === 'starting' ? 'Starting camera…' : state === 'found' ? 'Ticket found — opening…' : 'Point the camera at the ticket QR code'}
        </p>
        <button type="button" className="qrClose" onClick={close} aria-label="Stop scanning"><X size={20} /></button>
      </div>
      {open && cameras.length > 1 && (
        <label className="qrCamera">
          Camera
          <select value={cameraId} onChange={(event) => start(event.target.value)}>
            {cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
          </select>
        </label>
      )}
      {!open && <button type="button" className="button qrStart" onClick={() => start()}><Camera size={20} /> Scan ticket QR</button>}
      {message && <p className="adminError qrMessage" role="alert">{message}</p>}
    </div>
  );
}
