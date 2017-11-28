import { Component, ViewChild } from '@angular/core';

import { Platform } from 'ionic-angular';

import { Http } from '@angular/http';

import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';

import {
  FabContainer, Content, ActionSheetController,
  ModalController, PopoverController,
  Events, Keyboard, ToastController
} from 'ionic-angular';

import { NewsPopoverPage } from '../../components/newspopover.component';
import { FeedselectorPage } from './../feedselector/feedselector';
import { HallOfFamePage } from '../halloffame/halloffame.component';

import { NewsAggregatorService } from './../../providers/newsaggregator.services';
import { Db } from './../../providers/db';

import * as Packery from 'packery';
/*

  <ion-refresher (ionRefresh)="doPullRefresh($event)">
    <ion-refresher-content></ion-refresher-content>
  </ion-refresher>


  <ion-list no-lines [virtualScroll]="loadedItems" [bufferRatio]="10" [approxItemHeight]="'55px'">
    <ion-item-sliding #slider *virtualItem="let item">
  

*/

/**
 * Component HomePage 
 * 
 * Holds the main page for the news reader 
 */
@Component({
  selector: 'page-homepage',
  templateUrl: 'homepage.html'
})
export class HomePage {

  appVersion: Object = {
    'latestVersion': '0.1.21',
    'changeLog': [
      'Custom feeds',
      'UI overhaul',
      'Webapp tests',
      'Reworked internal engine. Added copy/paste for webapp.',
      'Techbullion added',
      'Tutorial fixes and major overhaul of code',
      'Fixed Bright code and code cleaning',
      'Fixed error handling and feed fix',
      'Sliding changed to left + tutorial update',
      'Changed layout popover and button position',
      'Added Mashable',
      'Created version info. Added feeds. Experimenting with position of buttons.BBC feed fix.'
    ]
  };

  loadedItems: Array<Object> = [];
  bufferedItems: Array<Object> = [];
  seenItems: Array<string> = [];
  itemCount: number = 0;
  hallOfFame: Object = {};



  // collections of feeds available and selected
  selectedFeeds: Object = { 'NewZeeTutorial': true }; // set the tutorial as default to true
  defaultFeeds: Array<Object> = [];
  customFeeds: Array<Object> = [];
  debuginfo: string = "";

  // overall app settings  
  appSettings: Object = {
    'maxAge': 2,
    'maxItemsInView': 1225,
    'refreshTime': 500,
    'pageScrollTime': 0,
    'bubbleDelay': 900,
    'debug': false,
    'toastdebug': false,
    'sortdate': true
  };

  // statistics
  feedStatistics: Object = {};
  statisticInfo: string = "";
  statTable = [];
  statCategories = [];

  // the newsfeed subscribed too
  newsSubscription: any;

  // for UI easening
  lastUserAction: number = 0; // time of the last user action
  isLoading: boolean = false;
  progressPercentage: string = "0%";

  showTiles: boolean = true;

  // needed for the scrollToTop and monitoring the scrolling progress (lazy loading image)
  @ViewChild(Content) content: Content;

  @ViewChild('gridPackery') gridPackery;
  pckry: any = null;

  constructor(
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private newsservice: NewsAggregatorService,
    public keyboard: Keyboard,
    private toastCtrl: ToastController,
    public events: Events,
    public db: Db,
    private http: Http,
    private platform: Platform,
    private iab: InAppBrowser,
    private socialSharing: SocialSharing,
    private actionSheetCtrl: ActionSheetController
  ) { }


  //  height()
  // platform.ready  en dan hoogte

  debuglog(s) {
    this.debuginfo = this.debuginfo + '<br>' + s;
  }

  /**
   * Lifecycle hook whenever the app is closed or loses focus, will save all stuff
   * 
   */
  ionViewWillEnter() {

    console.log('platforms', this.platform.platforms(), this.platform.height());

    //1447 desktop
    // 768 tablet

    this.platform.ready()
      .then(_ => {
        this.showTiles = this.platform.is('tablet') || this.platform.is('core')
      })

    this.lastUserAction = 0;
    setTimeout(() => {
      this.platform.ready().then(() => {
        this.db.initDB().then(() => {
          this.loadSettingsAndData();
          setTimeout(() => { this.doRefresh(); }, 1800);
        });
      });
    }, 500);
  }




  showActionSheet(item) {

    //    console.log('ACTION sheet item', item)

    this.actionSheetCtrl.create({
      title: 'Delete item',
      buttons: [

        {
          text: 'Open item',
          handler: () => {
            this.pressEvent(item, null);
          }
        },

        {
          text: 'Delete item',
          role: 'destructive',
          handler: () => {
            this.deleteItem(item, null);
          }
        },
        {
          text: 'Delete feed ' + item['prettylabel'],
          role: 'destructive',
          handler: () => {
            this.deleteFeed(item, null);
          }
        },
        {
          text: 'Share ... ',
          handler: () => {
            this.doSocialShare(item, null)
          }
        },
        {
          text: 'Toggle favorite',
          handler: () => {
            this.toggleFavorite(item, null);
          }
        },

        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
          }
        }
      ]
    }).present();
  }

  ionViewDidLoad() {
    // event subscription -  a bit of an oddity here, needed to support backdrop click for PopoverPage
    this.events.subscribe('toggle-favorite', (data) => {
      let hashcode = data['hashcode'];

      this.hallOfFame[hashcode] = data['item'];
      data['item']['favorite'] = !data['item']['favorite'];
    });

    this.events.subscribe('progress', (data) => {
      this.progressPercentage = Math.round((100 * data['value']) / data['total']).toString() + '%';

      if (data.error)
        this.debuginfo += ('<br> ' + data.text);
    });
  }
  // END OF LIFECYCLE HOOKS

  //
  // UI workers
  //
  toggleFavorite(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    item['favorite'] = !item['favorite'];
    this.addUpStatistic('favorite', item['prettylabel']);
    this.hallOfFame[item['hashcode']] = item;
  }

  doSocialShare(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.addUpStatistic('socialshare', item['prettylabel']);
    this.socialSharing.share("", item['description'], [], item['link']);
  }

  deleteItem(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.deleteNewsItem(item);
  }


  deleteFeed(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // remove all items with the same label
    let feedlabel = item['feedlabel'];

    // find the entries that need to get deleted
    for (let i = this.loadedItems.length - 1; i > -1; i--)
      if (this.loadedItems[i]['feedlabel'] == feedlabel) {

        // add it to the seen items
        if (this.seenItems.indexOf(this.loadedItems[i]['hashcode']) < 0)
          this.seenItems.push(this.loadedItems[i]['hashcode']);

        // remove it
        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }

    // remove from the settings
    this.selectedFeeds[item['feedlabel']] = false;

    // save the stuff
    this.saveSettingsAndData();
  }

  fabContainerClick() {
    this.lastUserAction = Date.now();
  }

  stepScrollUp() {
    let contentDimensions = this.content.getContentDimensions();
    let y = contentDimensions['scrollTop'] - contentDimensions['contentHeight'] + 55;
    this.content.scrollTo(0, y, this.appSettings['pageScrollTime']);
  }

  stepScrollDown() {
    let contentDimensions = this.content.getContentDimensions();
    let y = contentDimensions['scrollTop'] + contentDimensions['contentHeight'] - 55;
    this.content.scrollTo(0, y, this.appSettings['pageScrollTime']);
  }

  /**
   * Scroll the view to the top
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  scrollToTop(fab?: FabContainer) {
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();
    this.content.scrollToTop(5);
  }

  /**
   * Handle UI events to initiate refresh
   * 
   */
  doPushRefresh(fab?) {
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();
    if (!this.isLoading) this.doRefresh();
  }

  doPullRefresh(refresher?) {
    if ((refresher !== null) && (typeof refresher !== 'undefined')) refresher.complete();
    this.doRefresh();
  }

  /**
   * Move all items shown in the view to the seen list, but not the ones marked as favorite
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  seenAllItems(fab: FabContainer) {

    // register the user action 
    this.lastUserAction = Date.now();

    this.debuginfo = "";

    // close the fab
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();

    for (var i = this.loadedItems.length - 1; i >= 0; i--) {

      // only delete items which are not marked favorite
      //      if (!this.loadedItems[i]['favorite']) {
      {
        if (this.seenItems.indexOf(this.loadedItems[i]['hashcode']) < 0)
          this.seenItems.push(this.loadedItems[i]['hashcode']);

        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }
    }
    this.updateView();

    this.saveSettingsAndData();
  }

  //
  // Handling of new pages
  //
  showHallOfFame(slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // show the page and we pass quite some data .... 
    let popover = this.modalCtrl.create(HallOfFamePage, {
      hallOfFame: this.hallOfFame
    }, { enableBackdropDismiss: true });

    popover.present();

    popover.onDidDismiss(value => {
      if (value['hallOfFame'])
        this.hallOfFame = value['hallOfFame'];
    })
  }

  /**
   * Show the feedselector page
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  showFeedSelector(fab?: FabContainer) {
    // close the fab container list
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();

    // show the page and we pass quite some data .... 
    let modal = this.modalCtrl.create(FeedselectorPage, {
      defaultFeeds: this.defaultFeeds,
      customFeeds: this.customFeeds,
      selectedFeeds: this.selectedFeeds,
    }, { enableBackdropDismiss: true });

    modal.present();

    // handler for the action once the settings is closed
    modal.onDidDismiss((value) => {

      // place the settings if we did receive anything (backdrop delivers undefined, ESC press null)
      if ((typeof value !== 'undefined') && (value !== null)) {

        // store the setting in the app
        this.selectedFeeds = value.selectedFeeds;
        this.customFeeds = value.customFeeds;

        this.scrollToTop();

        this.saveSettingsAndData();
      }
    });
  }

  /**
  * Press event - go to deeplink
  * 
  * @param {Event} event - The event passed on
  * @param {Object} item - The newsitem
  * HTML removed: (press)="pressEvent(item,$event)" 
  */
  pressEvent(item, event) {

    if (Date.now() - this.lastUserAction > this.appSettings['bubbleDelay']) {

      this.saveSettingsAndData();

      // register the user action
      this.lastUserAction = Date.now();
      this.addUpStatistic('deeplink', item['prettylabel']);

      // open the site
      let browser = this.iab.create(item['link'], '_system');
      browser.show();
    }
  }

  /**
   * Click event - show the popover
   * 
   * @param {Event} event - The event passed on
   * @param {Object} item - The newsitem
   */
  clickEvent(item, event) {

    // hack for propagation of press event
    if (Date.now() - this.lastUserAction > this.appSettings['bubbleDelay']) {

      this.addUpStatistic('itemclicks', item['prettylabel']);

      // register the user action
      this.lastUserAction = Date.now();

      // create the popover
      let popover = this.popoverCtrl
        .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });

      // present the popover, no event passed, so it will be centered
      popover.present({});
    }
  }

  // Other internal stuff
  doRefresh() {

    this.debuginfo = "";

    // allow for full loading, only if loading is not already in progress
    if (!this.isLoading) {

      //console.log('In refresh', JSON.stringify(this.feedStatistics));

      // sanitise feedstatistics
      // if (this.feedStatistics !== null)
      Object.keys(this.feedStatistics).map(category => {
        this.defaultFeeds.concat(this.customFeeds).map(feed => {
          let label = feed['prettylabel'];
          if (typeof this.feedStatistics[category][label] === 'undefined')
            this.feedStatistics[category][label] = 0
        })
      })


      this.isLoading = true;



      document.title = "Loading...";

      // load the feeds from the active feeds
      this.newsSubscription = this.newsservice.loadRSSFeeds(

        // we are only looking at the feeds selected
        this.defaultFeeds.concat(this.customFeeds)
          .filter(feed => {
            return this.selectedFeeds[feed['feedlabel']]
          })

      )
        //  .do(item => { console.log('DEBUG0', item) })
        .filter((item) => {

          //console.log('In refresh1', item);
          // we are going to add this item, unless otherwise is defined below
          let additem = true;
          let hashcode = item['hashcode'];

          // is the item already in seen??
          if (this.seenItems.indexOf(hashcode) > -1) additem = false;

          // have we loaded it in this session already (in view or already in buffer)
          // possible issue here
          //        if (this.loadedItems
          //        .concat(this.bufferedItems)
          //      .find(item => item['hashcode'] == hashcode)) additem = false;

          // check the date
          if ((Date.now() - item['pubTime']) > (this.appSettings['maxAge'] * 24 * 60 * 60 * 1000))
            additem = false;

          return additem;
        })
        // .do(item => { console.log('DEBUG1', item) })
        .toArray()
        //  .do(item => { console.log('DEBUG2', item) })
        .subscribe(
        (newitems) => {
          // and set the buffer
          this.bufferedItems = newitems;

        },
        (item) => {
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.isLoading = false;
          console.log('COMPLETE', item)
          this.updateView();
        },
        (item) => {
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.isLoading = false;
          console.log('COMPLETE ERROR', item)
          this.updateView();
        })
    }
  }

  processStatistics(newItems) {
    newItems.map(item => {
      this.addUpStatistic('feedcount', item['prettylabel']);
    })
    //    console.log('Statistics ', JSON.stringify(this.feedStatistics, null, 2));
  }


  /*
      <ion-grid *ngFor="let cat of statCategories">
        {{cat}}
        <ion-row *ngFor="let row of statCategories[cat]">
          <ion-col>
            {{row[item]}}
          </ion-col>
          <ion-col>
            {{row[value]}}
          </ion-col>
        </ion-row>
      </ion-grid>
  */

  updateStatistics() {
    this.statisticInfo = JSON.stringify(this.feedStatistics, null, 2);


    this.statCategories = Object.keys(this.feedStatistics);

    this.statCategories.map(category => {
      this.statTable[category] = [];
      Object.keys(this.feedStatistics[category]).map(item => {
        this.statTable[category].push({ label: item, value: this.feedStatistics[category][item] })
      })
      this.statTable[category].sort(
        function (a, b) { return (a.value < b.value) ? 1 : ((b.value < a.value) ? -1 : 0); }
      );
    })

    // console.log('srot', this.statTable, this.statCategories)
  }

  clearConsole() {
    this.debuginfo = "";
    this.statisticInfo = "";
  }

  // will count double entries
  addUpStatistic(category, label) {
    if (typeof this.feedStatistics[category] === 'undefined') {
      this.feedStatistics[category] = {};
      this.feedStatistics[category][label] = 1;
    } else if (typeof this.feedStatistics[category][label] === 'undefined') {
      this.feedStatistics[category][label] = 1;
    } else this.feedStatistics[category][label] += 1;
  }


  setStatistic(category, label, value) {
    if (typeof this.feedStatistics[category] === 'undefined') {
      this.feedStatistics[category] = {};
      this.feedStatistics[category][label] = value;
    } else if (typeof this.feedStatistics[category][label] === 'undefined') {
      this.feedStatistics[category][label] = value;
    } else this.feedStatistics[category][label] = value;
  }

  deleteNewsItem(item) {
    if (this.seenItems.indexOf(item['hashcode']) < 0)
      this.seenItems.push(item['hashcode']);

    // find the entries that need to get deleted
    for (let i = this.loadedItems.length - 1; i > -1; i--)
      if (this.loadedItems[i]['hashcode'] == item['hashcode']) {
        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }
  }

  updateView() {

    document.title = "NewZee";
    // concat all items 
    this.loadedItems = this.loadedItems.concat(this.bufferedItems)

    // crude fix of double entries in full feed
    let data = {};
    this.loadedItems.map(item => {
      data[item['hashcode']] = item;
    })

    //    console.log('DATA', data);
    this.loadedItems = [];
    Object.keys(data).map(hashcode => {
      this.loadedItems.push(data[hashcode]);

      // some stuff for statistics last pubtime 
      let date = data[hashcode]['pubTime'];
      if (typeof date === 'undefined') date = Date.now();
      let value = new Date(date);
      let check = value.getFullYear() * 10000;
      check += (value.getMonth() + 1) * 100;
      check += value.getDate();
      this.setStatistic('lastdate', data[hashcode]['prettylabel'], check);
    })

    // may create double counts
    this.processStatistics(this.loadedItems);

    // sort the stuff
    this.loadedItems.sort((a, b) => {
      if (a['pubTime'] > b['pubTime']) {
        return -1;
      }
      if (a['pubTime'] < b['pubTime']) {
        return 1;
      }
      return 0;
    });

    // console.log('updateView3', this.loadedItems, this.bufferedItems)
    this.bufferedItems = this.loadedItems.slice(2000); //this.appSettings['maxItemsInView']);
    // console.log('updateView4', this.loadedItems, this.bufferedItems)

    this.loadedItems = this.loadedItems.slice(0, 2000); // this.appSettings['maxItemsInView']);
    // console.log('updateView5', this.loadedItems, this.bufferedItems)

    this.itemCount = this.loadedItems.length;

    this.scrollToTop();

    if (this.showTiles)
      setTimeout(() => {
        console.log('PACKERY ', this.gridPackery.nativeElement)

        this.pckry = new Packery(this.gridPackery.nativeElement, {
          itemSelector: ".grid-item",
          gutter: 10,
          columnWidth: 0,
          initLayout: true
        });

      }, 500)
  }

  /** 
   * Does a plain toast message on bottom of the page
   * 
   * Holds the main page for the news reader 
   * @param {string} message - The message to be toasted
   * @param {number} duration - Duration of the toast message
   * @returns {} nothing
  */
  doToast(message, duration) {
    let toast = this.toastCtrl.create({
      message: message,
      duration: duration,
      position: 'bottom',
      showCloseButton: true
    });

    toast.present();
  }

  saveSettingsAndData() {
    this.debuglog('DEBUG saving data');

    // clear seen items but make sure not too many are stored
    this.debuglog('SEEN ITEM COUNT ' + this.seenItems.length);
    if (this.seenItems.length > 5000) {
      this.seenItems = this.seenItems.slice(-2500);
      this.debuglog('CUTTING' + this.seenItems.length);
    }

    this.db.setkey('seenItems', this.seenItems)
      .then(re => { this.debuglog('Setting seenItems ' + this.seenItems.length.toString()) });

    // save the custom feeds
    this.db.setkey('customFeeds', this.customFeeds)
      .then(re => {// this.debuglog('Setting cf')
      });

    // hall of fame
    this.db.setkey('hallOfFame', this.hallOfFame)
      .then(re => { // this.debuglog('Setting hf'); 

      });

    // app settings
    this.db.setkey('appSettings', this.appSettings)
      .then(re => { // this.debuglog('Setting as'); 
      });

    // statistics
    this.db.setkey('feedStatistics', this.feedStatistics)//this.feedStatistics)
      .then(re => { //this.debuglog('Setting fs'); 
      });

    this.db.setkey('selectedFeeds', this.selectedFeeds)
      .then(re => { //this.debuglog('Setting sf'); 
      });
  }

  loadSettingsAndData() {
    // do the version update info 
    this.db.getkey('versioncount').then(
      (val) => {
        let versioncount = 0;

        // first time run, no toast
        if (val !== null) {
          versioncount = this.appVersion['changeLog'].length;
          this.db.setkey('versioncount', this.appVersion['changeLog'].length);
        } else
          // show toast if there was an update
          if (versioncount < this.appVersion['changeLog'].length) {

            // build the toast text from the array with the changelog
            let changelogtext = '';
            for (let i = 0; i < (this.appVersion['changeLog'].length - versioncount); i++)
              changelogtext = changelogtext + ' -  ' + this.appVersion['changeLog'][i];

            this.doToast('APP UPDATE (v' + this.appVersion['latestVersion'] + '):' + changelogtext, 15000);

            this.db.setkey('versioncount', this.appVersion['changeLog'].length);
          }
      })
      .catch(err => { this.debuglog('ERROR vc' + JSON.stringify(err)) })

    // load the app settings
    this.db.getkey('appSettings').then(
      (val) => {
        // in case we add settings to the default, this ensures we have them for the next time
        if (val != null) {
          Object.keys(val).map((key) => {
            this.appSettings[key] = val[key];
          });
        }
      })
      .catch(err => { this.debuglog('ERROR as' + JSON.stringify(err)) })

    // load the hall of fame
    this.db.getkey('hallOfFame').then(
      (val) => {
        this.debuglog('DEBUG hof type ' + typeof val);
        if (val != null) {
          this.hallOfFame = val;
          this.debuglog('DEBUG loaded existing hall of fame');
        }
      })
      .catch(err => { this.debuglog('ERROR hf' + JSON.stringify(err)) })

    // load the seenItems
    this.db.getkey('seenItems').then(
      (val) => {
        if (val != null) {
          this.seenItems = val;
          //this.seenItems = [];
          this.debuglog('SEEN ITEMS COUNT :' + this.seenItems.length.toString());
        }
      })
      .catch(err => { this.debuglog('ERROR seenitems' + JSON.stringify(err)) })

    // load the statistics
    this.db.getkey('feedStatistics').then(
      (val) => {
        if (val != null) {
          this.debuglog('DEBUG stat type ' + typeof val);
          this.debuglog('DEBUG loaded feedstatistics');
          this.feedStatistics = val;
        }
      })
      .catch(err => { this.debuglog('ERROR fs' + JSON.stringify(err)) })

    // load the settings for enabled service
    this.db.getkey('selectedFeeds').then(
      (val) => {
        this.debuglog('DEBUG selectedfeeds ' + typeof val);

        if (val != null) {
          this.selectedFeeds = val;

          this.debuglog('Loading selected feeds' + Object.keys(this.selectedFeeds).length.toString());

          // if there is no enabled services, then force selection of a feed
          if (Object.keys(val).length == 0) {
          } else {
            this.selectedFeeds = val;
          }
        }
      })
      .catch(err => { this.debuglog('ERROR sf' + JSON.stringify(err)) })

    // configure the feeds, need to save settings of deleted feeds (FUTURE)
    //    this.http.get('assets/newsfeeds.json')
    //    .map(res => res.json())
    //  .subscribe(res => {
    //  this.defaultFeeds = JSON.parse(



    let data =
      `
        [{
    "feedlabel": "NewZeeTutorial",
    "prettylabel": "NewZee Tutorial",
    "feedurl": "assets/tutorial.xml",
    "tags": "tutorial",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Dummydata",
    "prettylabel": "Dummy Data",
    "feedurl": "assets/dummydata.xml",
    "tags": "test",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/capgemini.png"
  },
  {
    "feedlabel": "dgMarket",
    "prettylabel": "dgMarket",
    "feedurl": "https://www.dgmarket.com/tenders/RssFeedAction.do?locationISO=_s%2c_p%2c_c%2c_l%2c_m%2c_a&keywords=&sub=66100000&noticeType=&language=&buyerId=",
    "tags": "tender",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
 {
    "feedlabel": "ITNewsAfrica",
    "prettylabel": "IT News Africa",
    "feedurl": "http://feeds.feedburner.com/itnewsafrica?format=xml",
    "tags": "tech africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

 {
    "feedlabel": "HowWeMadeItInAfrica",
    "prettylabel": "How We Made It In Africa",
    "feedurl": "http://feeds.feedburner.com/HowWeMadeItInAfrica?format=xml",
    "tags": "tech africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  
  {
    "feedlabel": "CoinTelegraph",
    "prettylabel": "Coin Telegraph",
    "feedurl": "https://cointelegraph.com/rss",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },


  {
    "feedlabel": "ElPaisTech",
    "prettylabel": "El Pais Tech",
    "feedurl": "http://ep00.epimg.net/rss/tecnologia/portada.xml",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },



  {
    "feedlabel": "Finnovista",
    "prettylabel": "Finnovista",
    "feedurl": "http://www.finnovista.com/feed/",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

 {
    "feedlabel": "Lifehacker",
    "prettylabel": "Lifehacker",
    "feedurl": "http://lifehacker.com/rss",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
 

 {
    "feedlabel": "GIZmodo",
    "prettylabel": "GIZmodo",
    "feedurl": "http://gizmodo.com/rss",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
 
  {
    "feedlabel": "DailyMonitor",
    "prettylabel": "dailymonitor",
    "feedurl": "http://www.monitor.co.ug/Business/688322-688322-view-asFeed-ey54eez/index.xml",
    "tags": "uganda",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },


  {
    "feedlabel": "Pymnts",
    "prettylabel": "Pymnts",
    "feedurl": "http://www.pymnts.com/feed/",
    "tags": "payments",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "Paymentsnews.com",
    "prettylabel": "PaymentsNews.com",
    "feedurl": "http://feedproxy.google.com/PaymentsNews",
    "tags": "payments",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "mobilepaymentstoday.com",
    "prettylabel": "MobilePaymentsToday.com",
    "feedurl": "https://www.mobilepaymentstoday.com/rss",
    "tags": "payments",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "informationweek.com",
    "prettylabel": "Information Week.com",
    "feedurl": "http://www.informationweek.com/rss_simple.asp",
    "tags": "digital",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "thepaypers",
    "prettylabel": "The Paypers",
    "feedurl": "http://www.thepaypers.com/syndication",
    "tags": "payments",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "BusinessDailyAfrica",
    "prettylabel": "Business Daily Africa",
    "feedurl": "  http://www.businessdailyafrica.com/latestrss.rss",
    "tags": "africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bd.jpg"
  },

  {
    "feedlabel": "Bright",
    "prettylabel": "Bright",
    "feedurl": "http://feeds.bright.nl/brightmagazine?format=xml",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bright.jpg"
  },

  {
    "feedlabel": "TheVergeAndroid",
    "prettylabel": "The Verge Android",
    "feedurl": "http://www.theverge.com/android/rss/index.xml",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "entry",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Tweakers Mixed",
    "prettylabel": "Tweakers Mixed",
    "feedurl": "http://feeds.feedburner.com/tweakers/mixed",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/tweakers.png"
  },
  {
    "feedlabel": "Rabobank FAR",
    "prettylabel": "Rabobank FAR",
    "feedurl": "https://research.rabobank.com/far/en/rss/rss-all-sectors.html",
    "tags": "opinion business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "Disrupt Africa",
    "prettylabel": "Disrupt Africa",
    "feedurl": "http://disrupt-africa.com/feed/",
    "tags": "fintech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Technofoliance",
    "prettylabel": "Technofoliance",
    "feedurl": "http://techfoliance.com/feed/",
    "tags": "fintech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },



  {
    "feedlabel": "Twitter Cyprus Mail",
    "prettylabel": "Twitter Cyprus Mail",
    "feedurl": "https://queryfeed.net/tw?q=%40cyprusmail",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  
  {
    "feedlabel": "Twitter PKawumi",
    "prettylabel": "Twitter PKawumi",
    "feedurl": "https://queryfeed.net/tw?q=%40pkawumi",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  

 

  

  {
    "feedlabel": "Twitter Geek.com",
    "prettylabel": "Twitter Geek.com",
    "feedurl": "https://queryfeed.net/tw?q=%40geekdotcom",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  

  {
    "feedlabel": "Twitter GTNews",
    "prettylabel": "Twitter GTNews",
    "feedurl": "https://queryfeed.net/tw?q=%40gtnewsdotcom",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  
  {
    "feedlabel": "Twitter UNCDFMM4P",
    "prettylabel": "Twitter UNCDFMM4P",
    "feedurl": "https://queryfeed.net/tw?q=%40UNCDFMM4P",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/UNCDFMM4P.jpg"
  },
  {
    "feedlabel": "Twitter FSD Uganda",
    "prettylabel": "Twitter FSD Uganda",
    "feedurl": "https://queryfeed.net/tw?q=%40FSDUganda",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "Twitter FSD Zambia",
    "prettylabel": "Twitter FSD Zambia",
    "feedurl": "https://queryfeed.net/tw?q=%40FSDZambia",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  
  {
    "feedlabel": "Twitter CGAP",
    "prettylabel": "Twitter CGAP",
    "feedurl": "https://queryfeed.net/tw?q=%40CGAP",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Twitter MicroSave",
    "prettylabel": "Twitter MicroSave",
    "feedurl": "https://queryfeed.net/tw?q=%40MicroSave",
    "tags": "twitter",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Guru8",
    "prettylabel": "Guru8",
    "feedurl": "https://guru8.net/feed/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BGR",
    "prettylabel": "BGR",
    "feedurl": "http://feeds.feedburner.com/TheBoyGeniusReport?format=xml",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "CFI.co",
    "prettylabel": "CFI.co",
    "feedurl": "http://cfi.co/feed/",
    "tags": "banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BankingTech tag fintech",
    "prettylabel": "Banking Technology Fintech Tag",
    "feedurl": "http://www.bankingtech.com/tag/fintech/feed/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BankingTech latestresources",
    "prettylabel": "Banking Technology Latest Resources",
    "feedurl": "http://www.bankingtech.com/category/format/latest-resources/feed/ ",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BankingTech news",
    "prettylabel": "Banking Technology News",
    "feedurl": "http://www.bankingtech.com/category/format/news/feed/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BankingTech LATAM",
    "prettylabel": "Banking Technology Latin America",
    "feedurl": "http://www.bankingtech.com/category/topic/region/latin-america/feed/",
    "tags": "fintech tech latin",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Fintech Hong Kong",
    "prettylabel": "Fintech Hong Kong",
    "feedurl": "http://fintechnews.hk/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Fintech Singapore",
    "prettylabel": "Fintech Singapore",
    "feedurl": "http://fintechnews.sg/feed/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "FiAsia",
    "prettylabel": "finews.asia",
    "feedurl": "http://www.finews.asia/?format=feed&type=rss",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "FrankWachting",
    "prettylabel": "FrankWatching",
    "feedurl": "http://feeds2.feedburner.com/frankwatching/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "BNR",
    "prettylabel": "BNR",
    "feedurl": "https://www.bnr.nl/?rss",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/BNR.jpg"
  },
  {
    "feedlabel": "SiliconCanals",
    "prettylabel": "SiliconCanals",
    "feedurl": "http://feeds.feedburner.com/SiliconCanals?format=xml",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/sc.png"
  },
  {
    "feedlabel": "SiliconCanals Curated",
    "prettylabel": "SiliconCanals Curated",
    "feedurl": "http://feeds.feedburner.com/curated/siliconcanals?format=xml",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Startupdates",
    "prettylabel": "Startupdates",
    "feedurl": "https://startupdates.nl/feed/",
    "tags": "fintech tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/startupdates.jpg"
  },
  {
    "feedlabel": "McKinsey Insights",
    "prettylabel": "McKinsey Insights",
    "feedurl": "http://www.mckinsey.com/Insights/rss.aspx",
    "tags": "opinion business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Instagram nlyozz",
    "prettylabel": "Instagram nlyozz",
    "feedurl": "https://queryfeed.net/instagram?q=nlyozz",
    "tags": "instagram",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Ars Technica",
    "prettylabel": "Ars Technica",
    "feedurl": "http://arstechnica.com/index.rssx",
    "tags": "tech news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Cap Gemini Latest Resources",
    "prettylabel": "Cap Gemini Latest Resources",
    "feedurl": "https://www.capgemini.com/rss.php/name/resources",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/capgemini.png"
  },
  

  {
    "feedlabel": "Cap Gemini CTO blog",
    "prettylabel": "Cap Gemini CTO blog",
    "feedurl": "https://www.capgemini.com/blog/261646/feed",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/capgemini.png"
  },
  {
    "feedlabel": "MTN Tech Blog",
    "prettylabel": "MTN Tech Blog",
    "feedurl": "http://blog.mtn.com.cy/feed_en",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NY Times Africa",
    "prettylabel": "NY Times Africa",
    "feedurl": "http://rss.nytimes.com/services/xml/rss/nyt/Africa.xml",
    "tags": "africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NY Times Europe",
    "prettylabel": "NY Times Europe",
    "feedurl": "http://rss.nytimes.com/services/xml/rss/nyt/Europe.xml",
    "tags": "europe",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NY Times HomePage",
    "prettylabel": "NY Times HomePage",
    "feedurl": "http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NY Times Technology",
    "prettylabel": "NY Times Technology",
    "feedurl": "http://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Makezine",
    "prettylabel": "Makezine",
    "feedurl": "http://makezine.com/feed/",
    "tags": "gossip",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },

  {
    "feedlabel": "Economist Science - Technology",
    "prettylabel": "Economist Science - Technology",
    "feedurl": "http://www.economist.com/sections/science-technology/rss.xml",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/economist.png"
  },
  {
    "feedlabel": "Economist Banking",
    "prettylabel": "Economist Banking",
    "feedurl": "http://www.economist.com/topics/banking/index.xml",
    "tags": "business banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/economist.png"
  },
  {
    "feedlabel": "TED talks",
    "prettylabel": "TED talks",
    "feedurl": "http://www.ted.com/talks/rss",
    "tags": "opinion",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NRC",
    "prettylabel": "NRC",
    "feedurl": "https://www.nrc.nl/rss/",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Financial Times Europe",
    "prettylabel": "Financial Times Europe",
    "feedurl": "http://www.ft.com/rss/home/europe",
    "tags": "business europe",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/ft.png"
  },
  {
    "feedlabel": "Engadget",
    "prettylabel": "Engadget",
    "feedurl": "https://www.engadget.com/rss.xml",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "DigitalTrends",
    "prettylabel": "DigitalTrends",
    "feedurl": "http://www.digitaltrends.com/feed/",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "AppsAfrica",
    "prettylabel": "AppsAfrica",
    "feedurl": "http://feeds.feedburner.com/Appsafrica",
    "tags": "tech africa fintech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Dezeen",
    "prettylabel": "Dezeen",
    "feedurl": "http://feeds.feedburner.com/dezeen?format=xml",
    "tags": "design",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Telecom Paper",
    "prettylabel": "Telecom Paper",
    "feedurl": "http://feeds.feedburner.com/telecompaper/uLYl?format=xml",
    "tags": "tech telecom news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/telecompaper.gif"
  },
  {
    "feedlabel": "Lusaka Times",
    "prettylabel": "Lusaka Times",
    "feedurl": "https://www.lusakatimes.com/feed/",
    "tags": "africa zambia",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/LT.png"
  },
  {
    "feedlabel": "Emerce",
    "prettylabel": "Emerce",
    "feedurl": "http://www.emerce.nl/nieuws/feed",
    "tags": "fintech ecommerce",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Mobile Payments Today",
    "prettylabel": "Mobile Payments Today",
    "feedurl": "https://www.mobilepaymentstoday.com/rss/",
    "tags": "payments fintech banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Bank Systems and Technology",
    "prettylabel": "Bank Systems and Technology",
    "feedurl": "http://www.banktech.com/rss_simple.asp",
    "tags": "banking tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Let us talk payments",
    "prettylabel": "Let us talk payments",
    "feedurl": "https://letstalkpayments.com/feed/",
    "tags": "payments fintech banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/ltp.jpeg"
  },
  {
    "feedlabel": "The Finanser",
    "prettylabel": "The Finanser",
    "feedurl": "http://thefinanser.com/feed/",
    "tags": "payments fintech banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/finanser.png"
  },
  {
    "feedlabel": "iCulture",
    "prettylabel": "iCulture",
    "feedurl": "http://feedpress.me/iculture?format=xml",
    "tags": "tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "American Banker",
    "prettylabel": "American Banker",
    "feedurl": "https://www.americanbanker.com/feed?rss=true",
    "tags": "banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/americanbanker.png"
  },
  {
    "feedlabel": "Reuters TOP Africa",
    "prettylabel": "Reuters TOP Africa",
    "feedurl": "http://feeds.reuters.com/reuters/AFRICATopNews?format=xml",
    "tags": "africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Uganda News",
    "prettylabel": "Reuters Uganda News",
    "feedurl": "http://feeds.reuters.com/reuters/AfricaUgandaNews?format=xml",
    "tags": "africa uganda",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Zambia News",
    "prettylabel": "Reuters Zambia News",
    "feedurl": "http://feeds.reuters.com/reuters/AfricaZambiaNews?format=xml",
    "tags": "africa zambia",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Africa Business",
    "prettylabel": "Reuters Africa Business",
    "feedurl": "http://feeds.reuters.com/reuters/AFRICAbusinessNews?format=xml",
    "tags": "africa business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Africa Oddly",
    "prettylabel": "Reuters Africa Oddly",
    "feedurl": "http://feeds.reuters.com/reuters/AFRICAOddlyenoughNews?format=xml",
    "tags": "africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "BizTech Africa",
    "prettylabel": "BizTech Africa",
    "feedurl": "http://www.biztechafrica.com/feed/rss/",
    "tags": "africa tech business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "All Africa Headlines",
    "prettylabel": "All Africa Headlines",
    "feedurl": "http://allafrica.com/tools/headlines/rdf/latest/headlines.rdf",
    "tags": "africa",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/allafrica.png"
  },
  {
    "feedlabel": "All Africa Banking",
    "prettylabel": "All Africa Banking",
    "feedurl": "http://allafrica.com/tools/headlines/rdf/banking/headlines.rdf",
    "tags": "africa banking",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/allafrica.png"
  },
  {
    "feedlabel": "All Africa Uganda",
    "prettylabel": "All Africa Uganda",
    "feedurl": "http://allafrica.com/tools/headlines/rdf/uganda/headlines.rdf",
    "tags": "africa uganda",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/allafrica.png"
  },
  {
    "feedlabel": "All Africa Zambia",
    "prettylabel": "All Africa Zambia",
    "feedurl": "http://allafrica.com/tools/headlines/rdf/zambia/headlines.rdf",
    "tags": "africa zambia",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/allafrica.png"
  },
  {
    "feedlabel": "Investors Internet Technology",
    "prettylabel": "Investors Internet Technology",
    "feedurl": "http://feeds.feedburner.com/InternetTechnologyRss?format=xml",
    "tags": "business tech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Finance Innovation",
    "prettylabel": "Finance Innovation",
    "feedurl": "http://www.financeinnovation.nl/feed/",
    "tags": "banking tech fintech",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/financeinnovation.png"
  },
  {
    "feedlabel": "Tech Crunch",
    "prettylabel": "Tech Crunch",
    "feedurl": "http://feeds.feedburner.com/TechCrunch/",
    "tags": "tech business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Financieel Dagblad",
    "prettylabel": "Financieel Dagblad",
    "feedurl": "https://fd.nl/?rss",
    "tags": "business",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/fd.png"
  },
  {
    "feedlabel": "RTL technieuws",
    "prettylabel": "RTL technieuws",
    "feedurl": "http://www.rtlnieuws.nl/service/rss/technieuws/index.xml",
    "prettyprovider": "RTL",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Reuters Science",
    "prettylabel": "Reuters Science",
    "feedurl": "http://feeds.reuters.com/reuters/scienceNews",
    "prettyprovider": "Reuters",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Technology",
    "prettylabel": "Reuters Technology",
    "feedurl": "http://feeds.reuters.com/reuters/technologyNews",
    "prettyprovider": "Reuters",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "Reuters Top News",
    "prettylabel": "Reuters Top News",
    "feedurl": "http://feeds.reuters.com/reuters/topNews",
    "prettyprovider": "Reuters",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/reuters.jpeg"
  },
  {
    "feedlabel": "BBC UK Technology",
    "prettylabel": "BBC UK Technology",
    "feedurl": "http://newsrss.bbc.co.uk/rss/newsonline_uk_edition/technology/rss.xml",
    "prettyprovider": "BBC News",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bbc_news_120x60.gif"
  },
  {
    "feedlabel": "BBC UK Science/Nature",
    "prettylabel": "BBC UK Technology",
    "feedurl": "http://newsrss.bbc.co.uk/rss/newsonline_uk_edition/sci/tech/rss.xml",
    "prettyprovider": "BBC News",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bbc_news_120x60.gif"
  },
  {
    "feedlabel": "BBC World Technology",
    "prettylabel": "BBC World Technology",
    "feedurl": "http://newsrss.bbc.co.uk/rss/newsonline_world_edition/technology/rss.xml",
    "prettyprovider": "BBC News",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bbc_news_120x60.gif"
  },
  {
    "feedlabel": "BBC World Science/Nature",
    "prettylabel": "BBC World Science/Nature",
    "feedurl": "http://newsrss.bbc.co.uk/rss/newsonline_world_edition/science/nature/rss.xml",
    "prettyprovider": "BBC News",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bbc_news_120x60.gif"
  },
  {
    "feedlabel": "BBC World Front Page",
    "prettylabel": "BBC World Front Page",
    "feedurl": "http://newsrss.bbc.co.uk/rss/newsonline_world_edition/front_page/rss.xml",
    "prettyprovider": "BBC News",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/bbc_news_120x60.gif"
  },
  {
    "feedlabel": "NOSNieuwsAlgemeen",
    "prettylabel": "NOS Nieuws Algemeen",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsAlgemeen?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsPolitiek",
    "prettylabel": "NOS Nieuws Politiek",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsPolitiek?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsBinnenland",
    "prettylabel": "NOS Nieuws Binnenland",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsBinnenland?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsBuitenland",
    "prettylabel": "NOS Nieuws Buitenland",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsBuitenland?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsEconomie",
    "prettylabel": "NOS Nieuws Economie",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsEconomie?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsOpmerkelijk",
    "prettylabel": "NOS Nieuws Opmerkelijk",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsOpmerkelijk?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsKoningshuis",
    "prettylabel": "NOS Nieuws Koningshuis",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsKoningshuis?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSNieuwsCultuurEnMedia",
    "prettylabel": "NOS Nieuws Cultuur En Media",
    "feedurl": "http://feeds.nos.nl/NOSNieuwsCultuurEnMedia?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSSportAlgemeen",
    "prettylabel": "NOS Sport Algemeen",
    "feedurl": "http://feeds.nos.nl/NOSSportAlgemeen?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NieuwsuurAlgemeen",
    "prettylabel": "Nieuwsuur Algemeen",
    "feedurl": "http://feeds.nos.nl/NieuwsuurAlgemeen?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "NOSOp3",
    "prettylabel": "NOS Op 3",
    "feedurl": "http://feeds.nos.nl/NOSOp3?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/nos.png"
  },
  {
    "feedlabel": "Jeugdjournaal",
    "prettylabel": "Jeugdjournaal",
    "feedurl": "http://feeds.nos.nl/Jeugdjournaal?format=xml",
    "prettyprovider": "NOS",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/jeugdjournaal.JPG"
  },
  {
    "feedlabel": "NU.nl algemeen",
    "prettylabel": "NU.nl Algemeen",
    "feedurl": "http://www.nu.nl/rss/algemeen",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NU.nl sport",
    "prettylabel": "NU.nl Sport",
    "feedurl": "http://www.nu.nl/rss/sport",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NU.nl internet",
    "prettylabel": "NU.nl Internet",
    "feedurl": "http://www.nu.nl/rss/internet",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NU.nl achterklap",
    "prettylabel": "NU.nl Achterklap",
    "feedurl": "http://www.nu.nl/rss/achterklap",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NU.nl opmerkelijk",
    "prettylabel": "NU.nl Opmerkelijk",
    "feedurl": "http://www.nu.nl/rss/opmerkelijk",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "NU.nl buitenland",
    "prettylabel": "NU.nl Buitenland",
    "feedurl": "http://www.nu.nl/rss/buitenland",
    "prettyprovider": "NU.nl",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "CNET News",
    "prettylabel": "CNET News",
    "feedurl": "https://www.cnet.com/rss/news/",
    "prettyprovider": "CNET",
    "tags": "news",
    "clearWords": ["- CNET"],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Top stories",
    "prettylabel": "Wired Top stories",
    "feedurl": "https://www.wired.com/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Business",
    "prettylabel": "Wired Business",
    "feedurl": "https://www.wired.com/category/business/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Design",
    "prettylabel": "Wired Design",
    "feedurl": "https://www.wired.com/category/design/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Tech",
    "prettylabel": "Wired Tech",
    "feedurl": "https://www.wired.com/category/gear/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Science",
    "prettylabel": "Wired Science",
    "feedurl": "https://www.wired.com/category/science/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Security",
    "prettylabel": "Wired Security",
    "feedurl": "https://www.wired.com/category/security/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Transportation",
    "prettylabel": "Wired Transportation",
    "feedurl": "https://www.wired.com/category/transportation/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  },
  {
    "feedlabel": "Wired Photo",
    "prettylabel": "Wired Photo",
    "feedurl": "https://www.wired.com/category/photo/feed/",
    "prettyprovider": "Wired",
    "tags": "news",
    "clearWords": [],
    "responsefilter": "standard",
    "itemfilter": "standard",
    "defaultthumb": "assets/img/newzee.png"
  }
]
        `;



    this.defaultFeeds = JSON.parse(data);


    //  any feeds custom added
    this.db.getkey('customFeeds').then(
      (val) => {
        if (val != null)
          this.customFeeds = val;
      });
    //  })
  }
}