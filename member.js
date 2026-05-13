// ============ MEMBER FUNCTIONS ============
let selectedMember = null;
let currentDiscount = 0;
let currentUsedPoints = 0;

// Load all members
async function loadMembers() {
  try {
    const res = await fetch('/api/members');
    const members = await res.json();
    displayMembersList(members);
    updateMemberSelect(members);
    updateMemberStats(members);
  } catch (error) {
    console.error("Error loading members:", error);
  }
}

// Update member select dropdown
function updateMemberSelect(members) {
  const select = document.getElementById('memberSelect');
  select.innerHTML = '<option value="">Non-Member</option>';
  
  members.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = `${member.member_code} - ${member.name} (${member.points} poin)`;
    select.appendChild(option);
  });
  
  // Add event listener for member selection
  select.onchange = (e) => {
    const memberId = e.target.value;
    if (memberId) {
      selectedMember = members.find(m => m.id == memberId);
    } else {
      selectedMember = null;
    }
    updateMemberInfoInCart();
  };
}

// Update member info in cart
function updateMemberInfoInCart() {
  const memberSelectDiv = document.querySelector('.member-select');
  if (selectedMember) {
    memberSelectDiv.innerHTML = `
      <label>👥 Member: ${selectedMember.name}</label>
      <span class="member-points">⭐ ${selectedMember.points} Poin</span>
      <button onclick="clearMember()" class="clear-member-btn">Ganti</button>
    `;
  } else {
    memberSelectDiv.innerHTML = `
      <label>👥 Member (Optional)</label>
      <select id="memberSelect">
        <option value="">Non-Member</option>
      </select>
    `;
    // Re-populate select
    fetch('/api/members').then(res => res.json()).then(members => {
      const select = document.getElementById('memberSelect');
      select.innerHTML = '<option value="">Non-Member</option>';
      members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.member_code} - ${member.name} (${member.points} poin)`;
        select.appendChild(option);
      });
      select.onchange = (e) => {
        const memberId = e.target.value;
        if (memberId) {
          fetch(`/api/members/${memberId}`).then(res => res.json()).then(member => {
            selectedMember = member;
            updateMemberInfoInCart();
          });
        } else {
          selectedMember = null;
          updateMemberInfoInCart();
        }
      };
    });
  }
}

function clearMember() {
  selectedMember = null;
  updateMemberInfoInCart();
}

// Display members list
function displayMembersList(members) {
  const container = document.getElementById('membersList');
  if (!container) return;
  
  if (members.length === 0) {
    container.innerHTML = '<div class="loading">Belum ada member terdaftar</div>';
    return;
  }
  
  container.innerHTML = '';
  members.forEach(member => {
    const tier = getTier(member.total_spent);
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="member-card-header">
        <strong>${member.name}</strong>
        <span class="member-tier ${tier.toLowerCase()}">${tier}</span>
      </div>
      <div class="member-card-body">
        <p>📝 Kode: ${member.member_code}</p>
        <p>📱 HP: ${member.phone || '-'}</p>
        <p>⭐ Poin: ${member.points}</p>
        <p>💰 Total Belanja: Rp ${(member.total_spent || 0).toLocaleString('id-ID')}</p>
        <p>📅 Bergabung: ${new Date(member.join_date).toLocaleDateString()}</p>
      </div>
      <div class="member-card-footer">
        <button onclick="viewMemberHistory(${member.id})" class="history-btn">📜 Riwayat</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function getTier(totalSpent) {
  if (totalSpent >= 1000000) return 'PLATINUM';
  if (totalSpent >= 500000) return 'GOLD';
  if (totalSpent >= 100000) return 'SILVER';
  return 'REGULAR';
}

function updateMemberStats(members) {
  const totalMembers = document.getElementById('totalMembers');
  const totalPoints = document.getElementById('totalPoints');
  
  if (totalMembers) totalMembers.textContent = members.length;
  if (totalPoints) {
    const sumPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);
    totalPoints.textContent = sumPoints;
  }
}

// Register new member
async function registerMember() {
  const name = document.getElementById('memberName')?.value.trim();
  const phone = document.getElementById('memberPhone')?.value.trim();
  const email = document.getElementById('memberEmail')?.value.trim();
  
  if (!name) {
    alert('⚠️ Nama member harus diisi!');
    return;
  }
  
  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email })
    });
    
    if (res.ok) {
      alert(`✅ Member "${name}" berhasil didaftarkan!`);
      document.getElementById('memberName').value = '';
      document.getElementById('memberPhone').value = '';
      document.getElementById('memberEmail').value = '';
      loadMembers();
    } else {
      const error = await res.json();
      alert(`❌ Gagal mendaftar: ${error.error}`);
    }
  } catch (error) {
    console.error("Error registering member:", error);
    alert('❌ Gagal terhubung ke server');
  }
}

// Search members
async function searchMembers() {
  const keyword = document.getElementById('memberSearch')?.value.trim();
  if (!keyword) {
    loadMembers();
    return;
  }
  
  try {
    const res = await fetch(`/api/members/search?name=${encodeURIComponent(keyword)}`);
    const members = await res.json();
    displayMembersList(members);
  } catch (error) {
    console.error("Error searching members:", error);
  }
}

// Load rewards
async function loadRewards() {
  try {
    const res = await fetch('/api/rewards');
    const rewards = await res.json();
    const container = document.getElementById('rewardsContainer');
    const totalRewards = document.getElementById('totalRewards');
    
    if (totalRewards) totalRewards.textContent = rewards.length;
    
    if (!container) return;
    
    if (rewards.length === 0) {
      container.innerHTML = '<div class="loading">Belum ada reward tersedia</div>';
      return;
    }
    
    container.innerHTML = '';
    rewards.forEach(reward => {
      const card = document.createElement('div');
      card.className = 'reward-card';
      card.innerHTML = `
        <h4>${reward.name}</h4>
        <p>⭐ Dibutuhkan: ${reward.points_required} poin</p>
        <p>🎁 Tipe: ${reward.reward_type}</p>
        ${reward.discount_value ? `<p>💰 Nilai: ${reward.reward_type === 'VOUCHER' ? (reward.discount_value > 100 ? `Rp ${reward.discount_value.toLocaleString('id-ID')}` : `${reward.discount_value}%`) : `Rp ${reward.discount_value.toLocaleString('id-ID')}`}</p>` : ''}
        <button onclick="redeemReward(${reward.id}, ${reward.points_required})" class="redeem-btn">Tukar Poin</button>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading rewards:", error);
  }
}

// Redeem reward
async function redeemReward(rewardId, pointsRequired) {
  if (!selectedMember) {
    alert('⚠️ Silakan pilih member terlebih dahulu!');
    return;
  }
  
  if (selectedMember.points < pointsRequired) {
    alert(`⚠️ Poin tidak mencukupi! Anda memiliki ${selectedMember.points} poin, butuh ${pointsRequired} poin.`);
    return;
  }
  
  if (confirm(`Tukar ${pointsRequired} poin untuk reward ini?`)) {
    try {
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          rewardId: rewardId,
          pointsRequired: pointsRequired
        })
      });
      
      if (res.ok) {
        alert('✅ Reward berhasil ditukar!');
        // Refresh member data
        const memberRes = await fetch(`/api/members/${selectedMember.id}`);
        selectedMember = await memberRes.json();
        updateMemberInfoInCart();
        loadMembers();
      } else {
        const error = await res.json();
        alert(`❌ Gagal menukar reward: ${error.error}`);
      }
    } catch (error) {
      console.error("Error redeeming reward:", error);
      alert('❌ Gagal terhubung ke server');
    }
  }
}

// View member transaction history
async function viewMemberHistory(memberId) {
  try {
    const res = await fetch(`/api/transactions/history/${memberId}`);
    const transactions = await res.json();
    const memberRes = await fetch(`/api/members/${memberId}`);
    const member = await memberRes.json();
    
    let historyText = `📜 RIWAYAT TRANSAKSI ${member.name}\n`;
    historyText += `═══════════════════════════\n`;
    historyText += `Total Poin: ${member.points}\n`;
    historyText += `Total Belanja: Rp ${(member.total_spent || 0).toLocaleString('id-ID')}\n`;
    historyText += `═══════════════════════════\n\n`;
    
    if (transactions.length === 0) {
      historyText += `Belum ada transaksi\n`;
    } else {
      transactions.forEach(trx => {
        historyText += `📅 ${new Date(trx.transaction_date).toLocaleDateString()}\n`;
        historyText += `💰 Rp ${trx.total_amount.toLocaleString('id-ID')}\n`;
        historyText += `⭐ Poin: +${trx.points_earned}\n`;
        historyText += `💳 ${trx.payment_method}\n`;
        historyText += `───────────────────\n`;
      });
    }
    
    alert(historyText);
  } catch (error) {
    console.error("Error loading history:", error);
    alert("Gagal memuat riwayat transaksi");
  }
}

// Apply points for discount
function applyPointsDiscount() {
  const pointsAmount = parseInt(document.getElementById('usePointsAmount')?.value);
  const totalAmount = currentCartTotal;
  const discountInfo = document.getElementById('discountInfo');
  
  if (!selectedMember) {
    alert('⚠️ Pilih member terlebih dahulu!');
    return;
  }
  
  if (isNaN(pointsAmount) || pointsAmount <= 0) {
    alert('⚠️ Masukkan jumlah poin yang valid!');
    return;
  }
  
  if (pointsAmount > selectedMember.points) {
    alert(`⚠️ Poin tidak mencukupi! Anda memiliki ${selectedMember.points} poin.`);
    return;
  }
  
  // Konversi poin ke diskon (100 poin = Rp 5.000 diskon)
  const maxDiscountFromPoints = Math.floor(pointsAmount / 100) * 5000;
  const discount = Math.min(maxDiscountFromPoints, totalAmount);
  
  currentUsedPoints = pointsAmount;
  currentDiscount = discount;
  
  discountInfo.innerHTML = `
    ✅ Diskon Rp ${discount.toLocaleString('id-ID')} dari ${pointsAmount} poin<br>
    💰 Total bayar: Rp ${(totalAmount - discount).toLocaleString('id-ID')}
  `;
  discountInfo.style.color = '#44ffaa';
  
  // Update display di modal
  document.getElementById('orderTotalAmount').innerHTML = `Rp ${(totalAmount - discount).toLocaleString('id-ID')}`;
  document.getElementById('totalPriceDisplay').innerHTML = `Rp ${(totalAmount - discount).toLocaleString('id-ID')}`;
  document.getElementById('nonCashTotal').innerHTML = `Rp ${(totalAmount - discount).toLocaleString('id-ID')}`;
}

// Update member info in order modal
function updateMemberInfoInModal() {
  const memberInfoSection = document.getElementById('memberInfoSection');
  const memberDetails = document.getElementById('memberDetails');
  const pointsToEarnSpan = document.getElementById('pointsToEarn');
  
  if (selectedMember) {
    memberInfoSection.classList.remove('hidden');
    const pointsToEarn = Math.floor(currentCartTotal / 1000) * 10; // Rp 1.000 = 10 poin
    memberDetails.innerHTML = `
      <p><strong>${selectedMember.name}</strong> (${selectedMember.member_code})</p>
      <p>⭐ Poin saat ini: ${selectedMember.points}</p>
    `;
    pointsToEarnSpan.textContent = pointsToEarn;
  } else {
    memberInfoSection.classList.add('hidden');
  }
}

// Export functions for global use
window.selectedMember = selectedMember;
window.loadMembers = loadMembers;
window.registerMember = registerMember;
window.searchMembers = searchMembers;
window.loadRewards = loadRewards;
window.redeemReward = redeemReward;
window.viewMemberHistory = viewMemberHistory;
window.applyPointsDiscount = applyPointsDiscount;
window.updateMemberInfoInModal = updateMemberInfoInModal;
window.clearMember = clearMember;

// Initialize member features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('registerMemberBtn')) {
    document.getElementById('registerMemberBtn').addEventListener('click', registerMember);
  }
  if (document.getElementById('searchMemberBtn')) {
    document.getElementById('searchMemberBtn').addEventListener('click', searchMembers);
  }
  if (document.getElementById('applyPointsBtn')) {
    document.getElementById('applyPointsBtn').addEventListener('click', applyPointsDiscount);
  }
  
  loadMembers();
  loadRewards();
});