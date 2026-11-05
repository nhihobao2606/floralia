import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Articles } from './articles';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('Articles', () => {
  let component: Articles;
  let fixture: ComponentFixture<Articles>;
  let http!: HttpTestingController;

  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    localStorage.setItem('adminToken', 'admin-test-token');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, Articles],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(Articles);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('adminToken');
  });

  it('loads live article rows and refreshes the selected status filter', () => {
    const listRequest = http.expectOne(request =>
      request.url === 'http://localhost:3002/api/admin/blogs'
      && request.params.get('page') === '1'
      && request.params.get('limit') === '5'
      && request.params.get('status') === 'all'
    );
    expect(listRequest.request.headers.get('Authorization')).toBe('Bearer admin-test-token');
    listRequest.flush({
      data: [{
        _id: '507f1f77bcf86cd799439011',
        slug: 'bai-viet-thu',
        title: 'Bài viết thật',
        category: 'Văn hóa trà',
        publishedAt: '2026-10-15T00:00:00.000Z',
        status: 'published',
        views: 125,
      }],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, published: 1, draft: 0, archived: 0, views: 125 },
    });
    fixture.detectChanges();

    expect(component.articles[0].title).toBe('Bài viết thật');
    expect(component.stats.views).toBe(125);
    expect(component.loading).toBe(false);

    component.selectFilter('draft');
    const draftRequest = http.expectOne(request =>
      request.url === 'http://localhost:3002/api/admin/blogs'
      && request.params.get('status') === 'draft'
    );
    draftRequest.flush({
      data: [],
      total: 0,
      page: 1,
      limit: 5,
      stats: { total: 1, published: 1, draft: 0, archived: 0, views: 125 },
    });
    fixture.detectChanges();

    expect(component.articles).toEqual([]);
    expect(component.activeFilter).toBe('draft');
  });

  it('opens and dismisses the logout confirmation from the top bar', () => {
    http.expectOne('http://localhost:3002/api/admin/blogs?page=1&limit=5&status=all').flush({
      data: [],
      total: 0,
      page: 1,
      limit: 5,
      stats: { total: 0, published: 0, draft: 0, archived: 0, views: 0 },
    });

    fixture.detectChanges();
    const logoutButton = fixture.nativeElement.querySelector('.topbar-logout') as HTMLButtonElement;
    logoutButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#logoutConfirmTitle')?.textContent).toContain('Xác nhận đăng xuất');
    component.cancelLogoutConfirmation();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#logoutConfirmTitle')).toBeNull();
  });

  it('requires acknowledgement before deleting an article and refreshes after confirmation', () => {
    const article = {
      _id: '507f1f77bcf86cd799439011',
      slug: 'bai-viet-thu',
      title: 'Bài viết cần xóa',
      category: 'Văn hóa trà',
      publishedAt: '2026-10-15T00:00:00.000Z',
      status: 'published' as const,
      views: 1284,
    };
    const initialRequest = http.expectOne('http://localhost:3002/api/admin/blogs?page=1&limit=5&status=all');
    initialRequest.flush({
      data: [article],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, published: 1, draft: 0, archived: 0, views: 1284 },
    });

    component.deleteArticle(article);
    expect(component.pendingDeleteArticle).toEqual(article);
    component.confirmDeleteArticle();
    http.expectNone(request => request.method === 'DELETE');

    component.deleteAcknowledged = true;
    component.confirmDeleteArticle();
    const deleteRequest = http.expectOne(request =>
      request.method === 'DELETE'
      && request.url === `http://localhost:3002/api/admin/blogs/${article._id}`
    );
    deleteRequest.flush({ success: true });

    const refreshedRequest = http.expectOne('http://localhost:3002/api/admin/blogs?page=1&limit=5&status=all');
    refreshedRequest.flush({
      data: [],
      total: 0,
      page: 1,
      limit: 5,
      stats: { total: 0, published: 0, draft: 0, archived: 0, views: 0 },
    });
    expect(component.pendingDeleteArticle).toBeNull();
    expect(component.articles).toEqual([]);
  });
});
