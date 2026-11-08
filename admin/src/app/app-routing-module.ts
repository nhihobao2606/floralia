import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor, canDeactivateArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { Orders } from './pages/orders_manage/orders/orders';
import { OrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { adminAuthGuard } from './guards/admin-auth.guard';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { Products } from './pages/product-manage/products/products';
import { ProductEditor, canDeactivateProductEditor } from './pages/product-manage/product-editor/product-editor';
import { Categories } from './pages/category-manage/categories/categories';
import { CategoryEditor, canDeactivateCategoryEditor } from './pages/category-manage/category-editor/category-editor';
import { AdminUsers } from './pages/users_manage/users/users';
import { AdminUserDetail } from './pages/users_manage/user-detail/user-detail';
import { AdminUserForm } from './pages/users_manage/user-form/user-form';

export const routes: Routes = [
  { path: 'admin-login', component: AdminLogin },
  { path: 'orders/:id', component: OrderDetail, canActivate: [adminAuthGuard] },
  { path: 'orders', component: Orders, canActivate: [adminAuthGuard] },
  { path: 'inventory/receive', loadComponent: () => import('./pages/inventory_manage/receive-stock/receive-stock').then(module => module.ReceiveStock), canActivate: [adminAuthGuard] },
  { path: 'inventory', loadComponent: () => import('./pages/inventory_manage/inventory/inventory').then(module => module.Inventory), canActivate: [adminAuthGuard] },
  { path: 'articles/new', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles/:id/edit', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles', component: Articles, canActivate: [adminAuthGuard] },
  { path: 'vouchers/new', loadComponent: () => import('./pages/vouchers_manage/voucher-form/voucher-form').then(module => module.AdminVoucherForm), canActivate: [adminAuthGuard] },
  { path: 'vouchers/:id/edit', loadComponent: () => import('./pages/vouchers_manage/voucher-form/voucher-form').then(module => module.AdminVoucherForm), canActivate: [adminAuthGuard] },
  { path: 'vouchers/:id', loadComponent: () => import('./pages/vouchers_manage/voucher-detail/voucher-detail').then(module => module.AdminVoucherDetail), canActivate: [adminAuthGuard] },
  { path: 'vouchers', loadComponent: () => import('./pages/vouchers_manage/vouchers/vouchers').then(module => module.AdminVouchers), canActivate: [adminAuthGuard] },
  { path: 'users/new', component: AdminUserForm, canActivate: [adminAuthGuard] },
  { path: 'users/:id/edit', component: AdminUserForm, canActivate: [adminAuthGuard] },
  { path: 'users/:id', component: AdminUserDetail, canActivate: [adminAuthGuard] },
  { path: 'users', component: AdminUsers, canActivate: [adminAuthGuard] },
  { path: '', redirectTo: 'admin-login', pathMatch: 'full' },
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  { path: '**', component: Pagenotfound },
];

routes.splice(routes.length - 1, 0,
  { path: 'products/new', component: ProductEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateProductEditor] },
  { path: 'products/:id/edit', component: ProductEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateProductEditor] },
  { path: 'products', component: Products, canActivate: [adminAuthGuard] },
  { path: 'categories/new', component: CategoryEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateCategoryEditor] },
  { path: 'categories/:id/edit', component: CategoryEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateCategoryEditor] },
  { path: 'categories', component: Categories, canActivate: [adminAuthGuard] },
);

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
