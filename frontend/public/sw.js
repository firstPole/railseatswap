self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'SeatSwap', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      data: data.data ?? {},
    })
  );
});