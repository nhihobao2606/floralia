import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './profile/profile';

const routes: Routes = [
  {path: '', component: Homepage, pathMatch: 'full'},
  {path: 'home', component: Homepage},
  {path: 'login', component: Login},
  {path: 'signup', component: Signup},
  {path: 'profile', component: Profile},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
