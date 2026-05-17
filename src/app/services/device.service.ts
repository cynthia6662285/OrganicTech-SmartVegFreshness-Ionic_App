import { Injectable } from '@angular/core';
import { Device } from '@capacitor/device';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private deviceId: string | null = null;

  async getDeviceId(): Promise<string> {
    // Sudah ada di memory — langsung return
    if (this.deviceId && this.deviceId.length > 5) {
      return this.deviceId;
    }

    // Prioritas 1: localStorage (paling konsisten di release)
    try {
      const stored = localStorage.getItem('organictech_device_uid');
      if (stored && stored.length > 5) {
        this.deviceId = stored;
        console.log('[Device] Dari localStorage:', this.deviceId);
        return this.deviceId;
      }
    } catch (e) {}

    // Prioritas 2: Capacitor Device ID
    try {
      const info = await Device.getId();
      if (info.identifier && info.identifier.length > 3) {
        this.deviceId = info.identifier;
        localStorage.setItem('organictech_device_uid', this.deviceId);
        console.log('[Device] Dari Capacitor:', this.deviceId);
        return this.deviceId;
      }
    } catch (e) {
      console.warn('[Device] Capacitor gagal:', e);
    }

    // Prioritas 3: Generate baru dan simpan PERMANEN
    this.deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('organictech_device_uid', this.deviceId);
    console.log('[Device] Generate baru:', this.deviceId);
    return this.deviceId;
  }
}