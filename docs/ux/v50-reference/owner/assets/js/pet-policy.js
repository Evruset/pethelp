(() => {
  const card = document.getElementById('pets-policy-card');
  if (!card) return;

  const policies = {
    barney: { name: 'Барни', state: 'active', meta: '№ •••• 2345 · действует до 12.05.2027' },
    murka: { name: 'Мурка', state: 'none' },
    lucky: { name: 'Лаки', state: 'expired', meta: '№ •••• 7812 · закончился 30.11.2025' }
  };
  const tabs = [...card.querySelectorAll('[data-policy-pet-select]')];
  const kicker = card.querySelector('[data-policy-kicker]');
  const title = card.querySelector('[data-policy-title]');
  const meta = card.querySelector('[data-policy-meta]');
  const action = card.querySelector('[data-policy-action]');
  const benefits = card.querySelector('[data-policy-benefits]');
  const proof = card.querySelector('[data-policy-proof]');
  const empty = card.querySelector('[data-policy-empty]');
  const emptyTitle = card.querySelector('[data-policy-empty-title]');

  const selectPet = (key, announce = true) => {
    const policy = policies[key];
    if (!policy) return;
    const activePolicy = policy.state === 'active';
    const expiredPolicy = policy.state === 'expired';
    card.dataset.policyPet = key;
    card.classList.toggle('is-uninsured', !activePolicy);
    tabs.forEach((tab) => {
      const active = tab.dataset.policyPetSelect === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
      const tabPolicy = policies[tab.dataset.policyPetSelect];
      const stateLabel = tab.querySelector('small');
      if (stateLabel && tabPolicy) stateLabel.textContent = tabPolicy.state === 'active' ? 'Полис активен' : tabPolicy.state === 'expired' ? 'Полис закончился' : 'Нет полиса';
    });
    kicker.textContent = activePolicy ? 'Текущий полис' : expiredPolicy ? 'Страховка закончилась' : 'Страховка питомца';
    title.textContent = activePolicy ? `Полис ${policy.name}` : expiredPolicy ? `Полис ${policy.name} истёк` : `${policy.name} без страховки`;
    meta.textContent = activePolicy || expiredPolicy ? policy.meta : 'Активный полис не найден';
    action.textContent = activePolicy ? 'Подробнее' : expiredPolicy ? 'Продлить или выбрать новый' : 'Подобрать страховку';
    benefits.hidden = !activePolicy;
    proof.hidden = !activePolicy;
    empty.hidden = activePolicy;
    if (!activePolicy) emptyTitle.textContent = expiredPolicy ? `Полис ${policy.name} закончился` : `У ${policy.name} пока нет страховки`;
    if (announce) {
      const live = document.getElementById('vh-live-status');
      if (live) live.textContent = activePolicy ? `Показан действующий полис питомца ${policy.name}.` : expiredPolicy ? `Полис питомца ${policy.name} закончился.` : `У питомца ${policy.name} нет действующей страховки.`;
    }
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => selectPet(tab.dataset.policyPetSelect)));
  action.addEventListener('click', () => { location.hash = '#insurance'; });
  selectPet(card.dataset.policyPet || 'barney', false);
})();
