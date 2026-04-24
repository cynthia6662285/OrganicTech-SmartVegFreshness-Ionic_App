import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AnimationController } from '@ionic/angular';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: false,
})
export class SplashPage implements OnInit {

  constructor(
    private router: Router,
    private animationCtrl: AnimationController
  ) {}

  async ngOnInit() {
    await this.playAnimation();
    await this.delay(2800);
    await this.exitAnimation();
    this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async playAnimation() {
    // Logo masuk dari bawah + fade in
    const logo = document.querySelector('.splash-logo') as HTMLElement;
    const title = document.querySelector('.splash-title') as HTMLElement;
    const subtitle = document.querySelector('.splash-subtitle') as HTMLElement;
    const dots = document.querySelector('.splash-dots') as HTMLElement;

    if (!logo || !title || !subtitle || !dots) return;

    // Logo animation
    const logoAnim = this.animationCtrl.create()
      .addElement(logo)
      .duration(800)
      .easing('cubic-bezier(0.34, 1.56, 0.64, 1)')
      .fromTo('transform', 'translateY(60px) scale(0.7)', 'translateY(0px) scale(1)')
      .fromTo('opacity', '0', '1');

    // Title animation
    const titleAnim = this.animationCtrl.create()
      .addElement(title)
      .duration(600)
      .delay(400)
      .easing('ease-out')
      .fromTo('transform', 'translateY(30px)', 'translateY(0px)')
      .fromTo('opacity', '0', '1');

    // Subtitle animation
    const subtitleAnim = this.animationCtrl.create()
      .addElement(subtitle)
      .duration(600)
      .delay(600)
      .easing('ease-out')
      .fromTo('transform', 'translateY(20px)', 'translateY(0px)')
      .fromTo('opacity', '0', '1');

    // Dots animation
    const dotsAnim = this.animationCtrl.create()
      .addElement(dots)
      .duration(400)
      .delay(900)
      .easing('ease-out')
      .fromTo('opacity', '0', '1');

    await Promise.all([
      logoAnim.play(),
      titleAnim.play(),
      subtitleAnim.play(),
      dotsAnim.play(),
    ]);
  }

  private async exitAnimation() {
    const container = document.querySelector('.splash-container') as HTMLElement;
    if (!container) return;

    const exitAnim = this.animationCtrl.create()
      .addElement(container)
      .duration(500)
      .easing('ease-in-out')
      .fromTo('opacity', '1', '0')
      .fromTo('transform', 'scale(1)', 'scale(1.05)');

    await exitAnim.play();
  }
}