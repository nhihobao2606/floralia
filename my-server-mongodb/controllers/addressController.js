const { ObjectId } = require('mongodb');
const User = require('../models/user');

// Confirm that the selected post-merger ward belongs to the selected province.
async function wardBelongsToProvince(wardCode, provinceCode) {
  if (!wardCode || !provinceCode) return false;
  try {
    const response = await fetch(`https://provinces.open-api.vn/api/v2/w/${encodeURIComponent(wardCode)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return false;
    const selectedWard = await response.json();
    return String(selectedWard.province_code) === String(provinceCode);
  } catch (err) {
    console.error('Administrative division lookup error:', err.message);
    return false;
  }
}

function keepSingleDefault(addresses, preferredId = null) {
  const preferred = preferredId
    ? addresses.find(address => address._id?.toString() === preferredId.toString())
    : addresses.find(address => address.isDefault) || addresses[0];
  const defaultId = preferred?._id?.toString();
  return addresses.map(address => ({
    ...address,
    isDefault: !!defaultId && address._id?.toString() === defaultId
  }));
}

// GET /api/addresses - Lấy danh sách địa chỉ
async function getAddresses(req, res) {
  try {
    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    let addresses = user.addresses || [];
    const defaultCount = addresses.filter(address => address.isDefault).length;
    if (addresses.length && defaultCount !== 1) {
      addresses = keepSingleDefault(addresses);
      await User.update(req.userId, { addresses });
    }
    res.json({ success: true, addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// POST /api/addresses - Thêm địa chỉ mới
async function addAddress(req, res) {
  try {
    const { fullName, phone, address, province, provinceCode, ward, wardCode, isDefault } = req.body;

    if (!fullName || !phone || !address || !province || !ward) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin địa chỉ.' });
    }
    if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(String(phone).trim())) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
    }

    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    const existingAddresses = user.addresses || [];
    if (existingAddresses.length >= 10) {
      return res.status(400).json({ success: false, message: 'Mỗi tài khoản chỉ được lưu tối đa 10 địa chỉ.' });
    }

    // Chỉ validate ward/province khi có wardCode và provinceCode (từ form địa chỉ chuẩn)
    // Khi lưu nhanh từ trang thanh toán (không có code) thì bỏ qua bước này
    if (wardCode && provinceCode) {
      if (!(await wardBelongsToProvince(wardCode, provinceCode))) {
        return res.status(400).json({
          success: false,
          message: 'Phường/xã không thuộc tỉnh/thành phố đã chọn. Vui lòng chọn lại địa chỉ hành chính.'
        });
      }
    }

    const newAddress = {
      _id: new ObjectId(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      province: province.trim(),
      provinceCode: provinceCode || null,
      ward: ward.trim(),
      wardCode: wardCode || null,
      fullAddress: `${address.trim()}, ${ward.trim()}, ${province.trim()}`,
      isDefault: false,
      createdAt: new Date()
    };

    const shouldBeDefault = existingAddresses.length === 0 || !!isDefault;
    const addresses = keepSingleDefault([...existingAddresses, newAddress], shouldBeDefault ? newAddress._id : null);
    Object.assign(newAddress, addresses[addresses.length - 1]);

    await User.update(req.userId, { addresses });

    res.json({ success: true, message: 'Thêm địa chỉ thành công!', address: newAddress });
  } catch (err) {
    console.error('addAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// PUT /api/addresses/:id - Cập nhật địa chỉ
async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const { fullName, phone, address, province, provinceCode, ward, wardCode, isDefault } = req.body;

    if (!fullName || !phone || !address || !province || !ward) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin địa chỉ.' });
    }
    if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(String(phone).trim())) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
    }

    // Chỉ validate ward/province khi có wardCode và provinceCode (từ form địa chỉ chuẩn)
    // Khi lưu nhanh từ trang thanh toán (không có code) thì bỏ qua bước này
    if (wardCode && provinceCode) {
      if (!(await wardBelongsToProvince(wardCode, provinceCode))) {
        return res.status(400).json({
          success: false,
          message: 'Phường/xã không thuộc tỉnh/thành phố đã chọn. Vui lòng chọn lại địa chỉ hành chính.'
        });
      }
    }

    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    const oldAddress = (user.addresses || []).find(a => a._id?.toString() === id);
    if (!oldAddress) return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.' });

    const currentAddresses = user.addresses || [];
    let addresses = currentAddresses.map(a => {
      const addrId = a._id?.toString();
      if (addrId === id) {
        return {
          ...a,
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          province: province.trim(),
          provinceCode: provinceCode || null,
          ward: ward.trim(),
          wardCode: wardCode || null,
          fullAddress: `${address.trim()}, ${ward.trim()}, ${province.trim()}`,
          isDefault: false,
        };
      }
      // Nếu địa chỉ này được đặt mặc định thì bỏ mặc định của cái khác
      return { ...a, isDefault: isDefault ? false : a.isDefault };
    });
    addresses = keepSingleDefault(addresses, isDefault || oldAddress.isDefault ? id : null);

    await User.update(req.userId, { addresses });

    const updated = addresses.find(a => a._id?.toString() === id);
    res.json({ success: true, message: 'Cập nhật địa chỉ thành công!', address: updated });
  } catch (err) {
    console.error('updateAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// DELETE /api/addresses/:id - Xóa địa chỉ
async function deleteAddress(req, res) {
  try {
    const { id } = req.params;

    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    const existingAddresses = user.addresses || [];
    if (!existingAddresses.some(a => a._id?.toString() === id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.' });
    }
    const targetAddress = existingAddresses.find(a => a._id?.toString() === id);
    if (targetAddress.isDefault) {
      return res.status(409).json({
        success: false,
        message: 'Không thể xóa địa chỉ mặc định. Hãy đặt một địa chỉ khác làm mặc định trước.'
      });
    }
    const addresses = keepSingleDefault(existingAddresses.filter(a => a._id?.toString() !== id));

    await User.update(req.userId, { addresses });

    res.json({ success: true, message: 'Xóa địa chỉ thành công!' });
  } catch (err) {
    console.error('deleteAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

// PUT /api/addresses/:id/default - Đặt làm địa chỉ mặc định
async function setDefaultAddress(req, res) {
  try {
    const { id } = req.params;

    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    if (!(user.addresses || []).some(a => a._id?.toString() === id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.' });
    }

    const addresses = keepSingleDefault(user.addresses || [], id);

    await User.update(req.userId, { addresses });

    res.json({ success: true, message: 'Đã đặt làm địa chỉ mặc định!' });
  } catch (err) {
    console.error('setDefaultAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
}

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };

