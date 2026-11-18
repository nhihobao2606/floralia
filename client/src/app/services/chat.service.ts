import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface SuggestedProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category?: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  stock: number;
  flavorNote?: string;
  tags?: string[];
  imageUrl?: string | null;
  variants?: any[];
}

export interface ChatResponse {
  sessionId?: string;
  reply: string;
  suggestedProducts: SuggestedProduct[];
  message?: any;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  suggestedProducts?: SuggestedProduct[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:3002/api/chat';

  private chatOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.chatOpenSubject.asObservable();

  private unreadSubject = new BehaviorSubject<boolean>(false);
  hasUnread$ = this.unreadSubject.asObservable();

  constructor(private http: HttpClient) {}

  toggleChat(): void {
    this.chatOpenSubject.next(!this.chatOpenSubject.value);
  }

  setChatOpen(open: boolean): void {
    this.chatOpenSubject.next(open);
  }

  isChatOpen(): boolean {
    return this.chatOpenSubject.value;
  }

  setHasUnread(hasUnread: boolean): void {
    this.unreadSubject.next(hasUnread);
  }

  getSessionId(): string {
    let sid = sessionStorage.getItem('floralia_chat_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('floralia_chat_session_id', sid);
    }
    return sid;
  }

  resetSessionId(): string {
    const sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('floralia_chat_session_id', sid);
    return sid;
  }

  getDatabaseMessages(): Observable<{ messages: ChatMessage[] }> {
    const sessionId = this.getSessionId();
    return this.http.get<{ messages: ChatMessage[] }>(`${this.apiUrl}/messages?sessionId=${sessionId}`);
  }

  sendMessage(message: string, history: Array<{ role: string; text: string }>): Observable<ChatResponse> {
    const sessionId = this.getSessionId();
    return this.http.post<ChatResponse>(this.apiUrl, {
      message,
      sessionId,
      history
    });
  }

  clearDatabaseSession(): Observable<{ success: boolean }> {
    const sessionId = this.getSessionId();
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/clear`, { sessionId });
  }
}
