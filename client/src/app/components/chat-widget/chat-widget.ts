import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { timeout } from 'rxjs/operators';
import { ChatService, ChatMessage, SuggestedProduct } from '../../services/chat.service';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-chat-widget',
  standalone: false,
  templateUrl: './chat-widget.html',
  styleUrls: ['./chat-widget.css']
})
export class ChatWidget implements OnInit, AfterViewChecked {
  @ViewChild('messagesScroll') private messagesScrollContainer!: ElementRef;
  @ViewChild('chatInput') private chatInputElement!: ElementRef<HTMLTextAreaElement>;

  isOpen = false;
  inputText = '';
  isLoading = false;
  hasUnread = false;
  shouldScroll = false;
  showFloat = false;

  quickPrompts: string[] = [
    '🌸 Trà vừa tốt sức khỏe vừa dưỡng nhan',
    '😴 Trà giúp ngủ ngon & giảm căng thẳng',
    '🍃 Trà thanh nhiệt, mát gan, giảm mụn',
    '🎁 Set quà tặng trà cao cấp'
  ];

  messages: ChatMessage[] = [];

  constructor(
    private chatService: ChatService,
    private cartService: CartService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.onScroll();
    // Tự động đồng bộ và nạp lịch sử tin nhắn trực tiếp từ Database MongoDB
    this.loadMessagesFromDatabase();

    // Lắng nghe yêu cầu mở/đóng chat từ nút bấm ngoài Header
    this.chatService.isOpen$.subscribe((open) => {
      this.ngZone.run(() => {
        if (this.isOpen !== open) {
          this.isOpen = open;
          if (this.isOpen) {
            this.hasUnread = false;
            this.chatService.setHasUnread(false);
            this.shouldScroll = true;
            this.loadMessagesFromDatabase();
            this.cdr.detectChanges();
            setTimeout(() => {
              this.scrollToBottom();
              this.chatInputElement?.nativeElement?.focus();
            }, 150);
          } else {
            this.cdr.detectChanges();
          }
        }
      });
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY || 0;
    this.showFloat = y > 200;
  }

  loadMessagesFromDatabase(): void {
    this.chatService.getDatabaseMessages().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res && Array.isArray(res.messages) && res.messages.length > 0) {
            this.messages = res.messages.map(m => ({
              id: m.id || 'msg-' + Date.now(),
              sender: m.sender,
              text: m.text,
              suggestedProducts: m.suggestedProducts || [],
              timestamp: new Date(m.timestamp)
            }));
          } else {
            this.messages = [{
              id: 'welcome-1',
              sender: 'bot',
              text: 'Xin chào! Mình là **Floralia AI** – chuyên gia tư vấn trà thảo mộc. Bạn đang tìm loại trà có hương vị thế nào hay có công dụng cụ thể nào (ví dụ: *dưỡng nhan, ngủ ngon, giảm mụn, thanh nhiệt*)? Hãy chia sẻ để mình chọn loại trà phù hợp nhất cho bạn nhé! 🍵✨',
              timestamp: new Date()
            }];
          }
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 50);
        });
      },
      error: () => {
        this.ngZone.run(() => {
          if (this.messages.length === 0) {
            this.messages = [{
              id: 'welcome-1',
              sender: 'bot',
              text: 'Xin chào! Mình là **Floralia AI** – chuyên gia tư vấn trà thảo mộc. Bạn đang tìm loại trà có hương vị thế nào hay có công dụng cụ thể nào (ví dụ: *dưỡng nhan, ngủ ngon, giảm mụn, thanh nhiệt*)? Hãy chia sẻ để mình chọn loại trà phù hợp nhất cho bạn nhé! 🍵✨',
              timestamp: new Date()
            }];
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  trackByMsgId(index: number, msg: ChatMessage): string {
    return msg.id || String(index);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const target = event.target as HTMLElement;
    // Nếu click bên trong component chatbot thì không đóng
    if (this.elementRef?.nativeElement?.contains(target)) {
      return;
    }
    // Nếu click vào nút toggle ngoài Header thì không can thiệp tại đây
    if (target.closest && target.closest('.fab-chat')) {
      return;
    }
    // Nếu click ra ngoài khung chat trên bất kỳ vị trí nào của trang web thì đóng khung chat
    this.ngZone.run(() => {
      this.closeChat();
    });
  }

  toggleChat(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.chatService.toggleChat();
  }

  closeChat(): void {
    this.isOpen = false;
    this.chatService.setChatOpen(false);
    this.cdr.detectChanges();
  }

  clearChat(): void {
    this.chatService.clearDatabaseSession().subscribe({
      next: () => {},
      error: () => {}
    });
    this.chatService.resetSessionId();
    this.messages = [{
      id: 'welcome-' + Date.now(),
      sender: 'bot',
      text: 'Cuộc trò chuyện đã được làm mới. Bạn cần Floralia tư vấn về dòng trà nào hôm nay ạ?',
      timestamp: new Date()
    }];
    this.shouldScroll = true;
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 50);
  }

  sendQuickPrompt(prompt: string): void {
    const cleanPrompt = prompt.replace(/^[\p{Emoji}\s]+/u, '').trim();
    this.sendMessage(cleanPrompt);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(customText?: string): void {
    const textToSend = (customText || this.inputText || '').trim();
    if (!textToSend || this.isLoading) return;

    // Chuẩn bị history các tin nhắn trước đó
    const history = this.messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text
    }));

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    // Hiển thị ngay tin nhắn người dùng lên khung chat
    this.messages = [...this.messages, userMessage];
    this.inputText = '';
    this.isLoading = true;
    this.shouldScroll = true;
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 30);

    // Cơ chế đồng bộ kép: Polling kiểm tra Database MongoDB mỗi 1.2s khi đang xử lý
    let isFinished = false;
    const initialCount = this.messages.length;
    const dbPollInterval = setInterval(() => {
      if (isFinished || !this.isLoading) {
        clearInterval(dbPollInterval);
        return;
      }
      this.chatService.getDatabaseMessages().subscribe({
        next: (dbRes) => {
          if (isFinished) return;
          if (dbRes && Array.isArray(dbRes.messages) && dbRes.messages.length > initialCount) {
            const lastMsg = dbRes.messages[dbRes.messages.length - 1];
            if (lastMsg && lastMsg.sender === 'bot') {
              isFinished = true;
              clearInterval(dbPollInterval);
              this.ngZone.run(() => {
                this.isLoading = false;
                this.messages = dbRes.messages.map(m => ({
                  id: m.id || 'msg-' + Date.now(),
                  sender: m.sender,
                  text: m.text,
                  suggestedProducts: m.suggestedProducts || [],
                  timestamp: new Date(m.timestamp)
                }));
                this.shouldScroll = true;
                this.cdr.detectChanges();
                setTimeout(() => this.scrollToBottom(), 50);
              });
            }
          }
        }
      });
    }, 1200);

    this.chatService.sendMessage(textToSend, history).pipe(
      timeout(12000)
    ).subscribe({
      next: (res) => {
        isFinished = true;
        clearInterval(dbPollInterval);
        this.ngZone.run(() => {
          this.isLoading = false;
          const botMessage: ChatMessage = {
            id: res?.message?.id || 'bot-' + Date.now(),
            sender: 'bot',
            text: res?.reply || 'Dưới đây là một số dòng trà phù hợp nhất với nhu cầu của bạn:',
            suggestedProducts: res?.suggestedProducts || [],
            timestamp: new Date()
          };
          // Kiểm tra xem tin nhắn đã được polling thêm chưa
          if (!this.messages.some(m => m.id === botMessage.id && m.sender === 'bot')) {
            this.messages = [...this.messages, botMessage];
          }
          this.shouldScroll = true;
          if (!this.isOpen) {
            this.hasUnread = true;
          }
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 50);
        });
      },
      error: (err) => {
        isFinished = true;
        clearInterval(dbPollInterval);
        this.ngZone.run(() => {
          this.isLoading = false;
          console.error('Chat error:', err);
          const errMessage: ChatMessage = {
            id: 'bot-err-' + Date.now(),
            sender: 'bot',
            text: 'Xin lỗi bạn, phản hồi từ chuyên gia trà đang bị chậm một chút. Bạn vui lòng thử gửi lại câu hỏi hoặc nhấn vào các gợi ý có sẵn nhé!',
            timestamp: new Date()
          };
          this.messages = [...this.messages, errMessage];
          this.shouldScroll = true;
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 50);
        });
      }
    });
  }

  renderMarkdown(content: string): string {
    if (!content) return '';
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // **in đậm**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // *in nghiêng*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Bullet points "* " hoặc "- "
    html = html.replace(/^[*-]\s+(.+)$/gm, '• $1');
    // Xuống dòng
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  viewProduct(slug: string): void {
    if (!slug) return;
    this.router.navigate(['/products', slug]);
  }

  addToCart(product: SuggestedProduct, event: Event): void {
    event.stopPropagation();
    const defaultVariant = product.variants?.find((v: any) => v.isDefault) || product.variants?.[0] || null;
    const cartProduct = {
      _id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice,
      discount: product.discount,
      stock: product.stock,
      variants: product.variants
    };

    this.cartService.addProduct(
      cartProduct,
      defaultVariant,
      1,
      product.imageUrl || '/assets/images/products/74.png'
    );
  }

  private saveChat(): void {
    try {
      sessionStorage.setItem('floralia_chat_history', JSON.stringify(this.messages.slice(-15)));
    } catch (e) {
      // ignore
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesScrollContainer) {
        this.messagesScrollContainer.nativeElement.scrollTop = this.messagesScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      // ignore
    }
  }
}
