import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SplashPageRoutingModule } from './splash-routing.module';
import { SplashPage } from './splash.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SplashPageRoutingModule
  ],
  declarations: [SplashPage]
})
export class SplashPageModule {}