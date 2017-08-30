import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

@Injectable()
export class Db {
    constructor(private storage: Storage) {};
 
    initDB() {
        return this.storage.ready();
    }

    setkey(key, value) {
        return this.storage.set(key, value);
    }

    getkey(key) {
        return this.storage.get(key);
    }
}