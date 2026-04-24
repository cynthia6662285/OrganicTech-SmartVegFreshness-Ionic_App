import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SettingsPageRoutingModule } from './settings-routing.module';
import { SettingsPage } from './settings.page';
import { PrivacyPolicyComponent } from '../../modals/privacy-policy/privacy-policy.component';
import { TermsConditionComponent } from '../../modals/terms-condition/terms-condition.component';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    SettingsPageRoutingModule
  ],
  declarations: [
    SettingsPage,
    PrivacyPolicyComponent,
    TermsConditionComponent
  ]
})
export class SettingsPageModule {}