import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-home',
  imports: [RouterLink],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.css',
})
export class DashboardHome {
  kpis = [
    {
      title: 'Revenue',
      value: '$48,290',
      change: '+12.5%',
      changeType: 'positive' as const,
      icon: '💰',
      color: 'success',
    },
    {
      title: 'Outstanding Invoices',
      value: '$12,450',
      change: '-3.2%',
      changeType: 'negative' as const,
      icon: '🧾',
      color: 'warning',
    },
    {
      title: 'New Leads',
      value: '24',
      change: '+8 this week',
      changeType: 'positive' as const,
      icon: '🎯',
      color: 'info',
    },
    {
      title: 'Stock Value',
      value: '$85,120',
      change: '320 items',
      changeType: 'neutral' as const,
      icon: '📦',
      color: 'primary',
    },
  ];

  recentActivity = [
    { type: 'Invoice', message: 'Invoice INV-2024-045 sent to Acme Corp', time: '10 min ago', icon: '🧾' },
    { type: 'Order', message: 'New sales order SO-2024-012 created', time: '1 hour ago', icon: '📦' },
    { type: 'Contact', message: 'New contact added: John Smith', time: '2 hours ago', icon: '👤' },
    { type: 'Payment', message: 'Payment received: $2,400 from Global Ltd', time: '3 hours ago', icon: '💳' },
    { type: 'Stock', message: 'Stock adjustment: 50 units of Widget A', time: '5 hours ago', icon: '🏬' },
  ];

  quickActions = [
    { label: 'New Invoice', icon: '🧾', route: '/invoices' },
    { label: 'New Contact', icon: '👥', route: '/contacts' },
    { label: 'New Product', icon: '📦', route: '/products' },
    { label: 'New Order', icon: '🛒', route: '/purchases' },
  ];
}
