import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor, canDeactivateArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { Orders } from './pages/orders_manage/orders/orders';
import { OrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { adminAuthGuard } from './guards/admin-auth.guard';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';

export const routes: Routes = [
  { path: 'admin-login', component: AdminLogin },
  { path: 'orders/:id', component: OrderDetail, canActivate: [adminAuthGuard] },
  { path: 'orders', component: Orders, canActivate: [adminAuthGuard] },
  { path: 'articles/new', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles/:id/edit', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles', component: Articles, canActivate: [adminAuthGuard] },
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  { path: '**', component: Pagenotfound },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
