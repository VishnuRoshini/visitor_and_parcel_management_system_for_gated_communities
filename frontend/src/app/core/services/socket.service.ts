import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '@env/environment';
import { Record } from '../models';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private connectionStatus = new BehaviorSubject<boolean>(false);
  
  public connectionStatus$ = this.connectionStatus.asObservable();

  // Event subjects
  private visitorNewSubject = new Subject<Record>();
  private visitorStatusUpdatedSubject = new Subject<Record>();
  private parcelNewSubject = new Subject<Record>();
  private parcelStatusUpdatedSubject = new Subject<Record>();

  // Public observables
  public visitorNew$ = this.visitorNewSubject.asObservable();
  public visitorStatusUpdated$ = this.visitorStatusUpdatedSubject.asObservable();
  public parcelNew$ = this.parcelNewSubject.asObservable();
  public parcelStatusUpdated$ = this.parcelStatusUpdatedSubject.asObservable();

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.connectionStatus.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connectionStatus.next(false);
    });

    // Listen for events
    this.socket.on('visitor:new', (data: Record) => {
      this.visitorNewSubject.next(data);
    });

    this.socket.on('visitor:status-updated', (data: Record) => {
      this.visitorStatusUpdatedSubject.next(data);
    });

    this.socket.on('parcel:new', (data: Record) => {
      this.parcelNewSubject.next(data);
    });

    this.socket.on('parcel:status-updated', (data: Record) => {
      this.parcelStatusUpdatedSubject.next(data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinResidentRoom(residentId: number): void {
    if (this.socket?.connected) {
      this.socket.emit('join:resident-room', residentId);
    }
  }

  leaveResidentRoom(residentId: number): void {
    if (this.socket?.connected) {
      this.socket.emit('leave:resident-room', residentId);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
