import { Debug } from './../../providers/debug';
import { Component } from '@angular/core';

import { NavController, NavParams, ViewController,  AlertController, PopoverController } from 'ionic-angular';

import { NewsPopoverPage } from './../page1/newspopover.component';


@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {

  hallOfFame: Object = {};
  hallOfFameList: Array<string> = [];

  appSettings: Object = {};
  feedStatistics: Object = {};
  statisticsList: Array<Object> = [];
  sortKey: string = 'article count';
  keyIndex: number = 0;
  sortKeys: Array<string> = ['article count', 'relevance percentage', 'clicks', 'deeplinks', 'last pub'];
  model: string = "No Model";

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private alertCtrl: AlertController,
 //   private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private debug: Debug,
    public viewCtrl: ViewController) {
  }

  clickEvent(item, event) {
    let popover = this.popoverCtrl
      .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });
    popover.present({});
  }

  ionViewDidLoad() {
    let minrelevance: number = 0;
    let maxrelevance: number = 0;

    this.appSettings = this.navParams.get('appSettings');
    this.feedStatistics = this.navParams.get('feedStatistics');

    this.sortKey = this.sortKey[0];

    Object.keys(this.feedStatistics).map((item) => {
      // determine average relevance
      let avgrelevance = Math.round(this.feedStatistics[item]['relevance'] / this.feedStatistics[item]['article count']);

      // record the boundaries
      if (avgrelevance > maxrelevance) maxrelevance = avgrelevance;
      if (avgrelevance < minrelevance) minrelevance = avgrelevance;

      // fill the empty items
      this.sortKeys.map(sortkey => {
        if (typeof this.feedStatistics[item][sortkey] === 'undefined') this.feedStatistics[item][sortkey] = 0;
      });

      // how old? age in hours
      if (this.feedStatistics[item]['last pub'] == 0) this.feedStatistics[item]['last pub'] = Date.now() - 2 * 24 * 60 * 60 * 1000;
      let howOld = Math.round((Date.now() - this.feedStatistics[item]['last pub']) / 1000 / 60 / 60);

      // put them on the list - could do Object.assign too
      this.statisticsList.push({
        feedlabel: this.feedStatistics[item]['feedlabel'],
        'article count': this.feedStatistics[item]['article count'],
        relevance: this.feedStatistics[item]['relevance'],
        clicks: this.feedStatistics[item]['clicks'],
        deeplinks: this.feedStatistics[item]['deeplinks'],
        avgrelevance: avgrelevance,
        'last pub': howOld
      });
    });

    // add percentage
    this.statisticsList.map((item) => {
      if ((maxrelevance - minrelevance) != 0)
        item['relevance percentage'] = Math.round(
          ((item['avgrelevance'] - minrelevance) /
            (maxrelevance - minrelevance)) * 100)
      else item['relevance percentage'] = 100;
    });
  }

  toggleSort() {
    this.keyIndex = this.keyIndex + 1;
    if (this.keyIndex == (this.sortKeys.length)) this.keyIndex = 0;

    this.statisticsList.sort(
      (a, b) => {
        let a1: number = a[this.sortKeys[this.keyIndex]];
        let b1: number = b[this.sortKeys[this.keyIndex]];
        return b1 - a1;
      }
    );
  }

  clearStatistics() {
    this.feedStatistics = {};
    this.statisticsList = [];
  }

  dismiss() {
    this.debug.setToastLogging(this.appSettings['toastdebug']);
    this.debug.setLogging(this.appSettings['debug']);

    this.viewCtrl.dismiss({ appSettings: this.appSettings, feedStatistics: this.feedStatistics });
  }

  clearAll() {
    let confirm = this.alertCtrl.create({
      title: 'Sure to start afresh?',
      message: 'Are you sure to delete all settings and start over again?',
      buttons: [
        {
          text: 'No',
          handler: () => {
            console.log('Disagree clicked');
          }
        },
        {
          text: 'Yes',
          handler: () => {
            this.clearAllFinal();
          }
        }
      ]
    });
    confirm.present()
  }

  clearAllFinal() {

    /*
    this.storage.remove('seenItems');
    this.storage.remove('newsModel');
    this.storage.remove('enabledServices');
    this.storage.remove('statisticsList');
    this.storage.remove('lastError');
    this.storage.remove('newsItems');
*/
    window.location.reload();
  }
}
