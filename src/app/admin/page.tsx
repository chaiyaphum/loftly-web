import { redirect } from 'next/navigation';

/** Admin index redirects to Cards — no dedicated dashboard yet. */
export default function AdminIndex() {
  redirect('/admin/cards');
}
