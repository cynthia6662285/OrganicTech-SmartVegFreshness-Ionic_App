import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-terms-condition',
  templateUrl: './terms-condition.component.html',
  styleUrls: ['./terms-condition.component.scss'],
  standalone: false,
})
export class TermsConditionComponent {
  constructor(private modalCtrl: ModalController) {}

  tutup() {
    this.modalCtrl.dismiss();
  }
}