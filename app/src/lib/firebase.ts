import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref } from 'firebase/database'

// The only copy of the Firebase config. The web config is public by design;
// access is controlled by Realtime Database rules + Firebase Auth.
const firebaseConfig = {
  apiKey: 'AIzaSyCEJbD5Md0ZX2ADT4nViQNxKn3t5d18ttA',
  authDomain: 'ys60-d283a.firebaseapp.com',
  databaseURL: 'https://ys60-d283a-default-rtdb.firebaseio.com',
  projectId: 'ys60-d283a',
  storageBucket: 'ys60-d283a.firebasestorage.app',
  messagingSenderId: '245526155541',
  appId: '1:245526155541:web:bac59abdb73656470f191c',
}

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const auth = getAuth(app)

// All event data lives under events/{EVENT_ID}. Tests set VITE_EVENT_ID=ys60-test.
export const EVENT_ID: string = import.meta.env.VITE_EVENT_ID ?? 'ys60'

export function eventPath(path = ''): string {
  return path ? `events/${EVENT_ID}/${path}` : `events/${EVENT_ID}`
}

export function eventRef(path = '') {
  return ref(db, eventPath(path))
}
