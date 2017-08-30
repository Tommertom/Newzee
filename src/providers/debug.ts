import { Injectable } from '@angular/core';

import {
  ToastController
} from 'ionic-angular';


/*
  Generated class for the Debug provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Debug {

  willLog: boolean = true;
  logCounter: number = 0;
  toastPositionCounter = 0;
  toastLog: boolean = false;
  toastPositions = ['top', 'middle', 'bottom'];

  constructor( private toastCtrl: ToastController) {
  }

  doToast(message, duration) {
      let toast = this.toastCtrl.create({
        message: message,
        duration: duration,
        position: this.toastPositions[this.toastPositionCounter],
        showCloseButton: true
      });

      this.toastPositionCounter = this.toastPositionCounter + 1;
      if (this.toastPositionCounter > this.toastPositions.length - 1) this.toastPositionCounter = 0;

      toast.present();
  }


  setToastLogging(val) {
    this.toastLog = val;
  }

  getToastLogging() {
    return this.toastLog;
  }

  setLogging(val) {
    this.willLog = val;
  }

  getLogging() {
    return this.willLog;
  }


  log(data) {
    if (this.willLog) {

      let logstring = this.logCounter.toString() + ' : ' + data;
      this.logCounter = this.logCounter + 1;

      console.log('DEBUG ', logstring);
      if (this.toastLog) this.doToast('DEBUG ' + logstring, 4000);
    }
  }

}
