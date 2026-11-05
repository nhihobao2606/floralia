import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor, canDeactivateArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { adminAuthGuard } from './guards/admin-auth.guard';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { Products } from './pages/product-manage/products/products';
import { ProductEditor, canDeactivateProductEditor } from './pages/product-manage/product-editor/product-editor';
import { Categories } from './pages/category-manage/categories/categories';
import { CategoryEditor, canDeactivateCategoryEditor } from './pages/category-manage/category-editor/category-editor';

export const routes: Routes = [
  { path: 'admin-login', component: AdminLogin },
  { path: 'articles/new', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles/:id/edit', component: ArticleEditor, canActivate: [adminAuthGuard], canDeactivate: [canDeactivateArticleEditor] },
  { path: 'articles', component: Articles, canActivate: [adminAuthGuard] },
  { path: '', redirectTo: 'admin-login', pathMatch: 'full' },
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
