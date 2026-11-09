import { Component, computed, signal } from '@angular/core';

export interface Item {
  id: number;
  name: string;
  category: string;
  price: number;
}

export const ITEMS: Item[] = [
  { id: 1, name: 'Apple', category: 'Fruit', price: 0.5 },
  { id: 2, name: 'Banana', category: 'Fruit', price: 0.25 },
  { id: 3, name: 'Carrot', category: 'Vegetable', price: 0.3 },
  { id: 4, name: 'Broccoli', category: 'Vegetable', price: 1.2 },
  { id: 5, name: 'Cheddar Cheese', category: 'Dairy', price: 4.5 },
  { id: 6, name: 'Milk', category: 'Dairy', price: 1.1 },
  { id: 7, name: 'Sourdough Bread', category: 'Bakery', price: 3.75 },
  { id: 8, name: 'Croissant', category: 'Bakery', price: 2.0 },
  { id: 9, name: 'Orange', category: 'Fruit', price: 0.6 },
  { id: 10, name: 'Spinach', category: 'Vegetable', price: 2.4 },
];

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly items = signal<Item[]>(ITEMS);
  protected readonly query = signal('');

  protected readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    );
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.query.set('');
  }
}
