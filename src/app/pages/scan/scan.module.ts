import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ScanPageRoutingModule } from './scan-routing.module';
import { ScanPage } from './scan.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ScanPageRoutingModule
  ],
  declarations: [ScanPage]
})
export class ScanPageModule {}