import { Injectable, Pipe, PipeTransform } from '@angular/core';

/*
  Generated class for the Sortpipe pipe.

  See https://angular.io/docs/ts/latest/guide/pipes.html for more info on
  Angular 2 Pipes.
*/
@Pipe({
    name: 'sortpipe'
})
@Injectable()
export class Sortpipe implements PipeTransform {
    /*
      Takes a value and makes it lowercase.
     */
    transform(allItems: Object[]) {
        // sort the items
        allItems.sort(
            (a, b) => {
                //let now = Date.now();
                return (b['pubTime']- a['pubTime'])
                //   return (b['relevance'] - (now - b['pubTime'])) - (a['relevance'] - (now - a['pubTime']))
            } // can be simplified
        );

        return allItems;
    }
}
