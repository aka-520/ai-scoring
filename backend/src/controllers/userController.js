const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

function parseRoles(user) {
  try { return JSON.parse(user.roles); } catch { return [user.roles]; }
}

const orgInclude = {
  division: true,
  department: { include: { division: true } },
  section: { include: { department: { include: { division: true } } } },
};

exports.getAll = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: orgInclude,
      orderBy: { username: 'asc' },
    });
    res.json(users.map(u => ({ ...u, roles: parseRoles(u), password: undefined })));
  } catch (err) {
    res.status(500).json({ error: '取得使用者清單失敗：' + err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id }, include: orgInclude });
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    res.json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '取得使用者失敗：' + err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { username, password, name, roles, divisionId, departmentId, sectionId } = req.body;
    if (!username || !password || !name || !roles) {
      return res.status(400).json({ error: '請提供帳號、密碼、姓名與角色' });
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: '請至少選擇一個角色' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密碼至少需要 6 個字元' });
    }

    const existing = await prisma.user.findFirst({ where: { username, active: true } });
    if (existing) return res.status(400).json({ error: '帳號已存在' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashed,
        name,
        roles: JSON.stringify(roles),
        divisionId:   divisionId   ? parseInt(divisionId)   : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        sectionId:    sectionId    ? parseInt(sectionId)    : null,
        mustChangePassword: true,
      },
      include: orgInclude,
    });
    res.status(201).json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '建立使用者失敗：' + err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, roles, divisionId, departmentId, sectionId, active, mustChangePassword } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (roles !== undefined) {
      if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles 必須為陣列' });
      if (roles.length === 0) return res.status(400).json({ error: '請至少選擇一個角色' });
      data.roles = JSON.stringify(roles);
    }
    if (divisionId  !== undefined) data.divisionId  = divisionId  ? parseInt(divisionId)  : null;
    if (departmentId !== undefined) data.departmentId = departmentId ? parseInt(departmentId) : null;
    if (sectionId   !== undefined) data.sectionId   = sectionId   ? parseInt(sectionId)   : null;
    if (active !== undefined) data.active = active;
    if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

    const user = await prisma.user.update({ where: { id }, data, include: orgInclude });
    res.json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '更新使用者失敗：' + err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密碼至少需要 6 個字元' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashed, mustChangePassword: true },
    });
    res.json({ message: '密碼已重設，使用者下次登入必須變更密碼' });
  } catch (err) {
    res.status(500).json({ error: '重設密碼失敗：' + err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: '無法刪除自己的帳號' });
    }
    await prisma.user.update({ where: { id }, data: { active: false } });
    res.json({ message: '帳號已停用，評分記錄已保留' });
  } catch (err) {
    res.status(500).json({ error: '刪除使用者失敗：' + err.message });
  }
};
