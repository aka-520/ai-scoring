const prisma = require('../prisma');

exports.getStats = async (req, res) => {
  const kpi = await getKpiStats();

  const deptStats = await prisma.department.findMany({
    include: {
      division: true,
      scenes: {
        where: { active: true },
        select: { status: true, timeSavedHours: true, actualTimeSavedHours: true },
      },
    },
  });

  const departments = deptStats.map(d => ({
    id: d.id,
    name: d.name,
    division: d.division?.name,
    total: d.scenes.length,
    completed: d.scenes.filter(s => s.status === '已完成').length,
    inProgress: d.scenes.filter(s => s.status === '進行中').length,
    timeSaved: d.scenes.reduce((sum, s) => sum + (s.timeSavedHours || 0), 0),
    actualTimeSaved: d.scenes.reduce((sum, s) => sum + (s.actualTimeSavedHours || 0), 0),
  }));

  res.json({ kpi, departments });
};

exports.drilldown = async (req, res) => {
  const { level, id } = req.query;

  if (level === 'division') {
    const departments = await prisma.department.findMany({
      where: { divisionId: parseInt(id) },
      include: { scenes: { where: { active: true }, select: { status: true, timeSavedHours: true, actualTimeSavedHours: true } } },
    });
    return res.json(departments.map(d => ({
      id: d.id, name: d.name, type: 'department',
      total: d.scenes.length,
      completed: d.scenes.filter(s => s.status === '已完成').length,
      inProgress: d.scenes.filter(s => s.status === '進行中').length,
      timeSaved: d.scenes.reduce((s, x) => s + (x.timeSavedHours || 0), 0),
    })));
  }

  if (level === 'department') {
    const sections = await prisma.section.findMany({
      where: { departmentId: parseInt(id) },
      include: { scenes: { where: { active: true }, select: { status: true, timeSavedHours: true } } },
    });
    return res.json(sections.map(s => ({
      id: s.id, name: s.name, type: 'section',
      total: s.scenes.length,
      completed: s.scenes.filter(x => x.status === '已完成').length,
      inProgress: s.scenes.filter(x => x.status === '進行中').length,
      timeSaved: s.scenes.reduce((acc, x) => acc + (x.timeSavedHours || 0), 0),
    })));
  }

  if (level === 'section') {
    const scenes = await prisma.scene.findMany({
      where: { sectionId: parseInt(id), active: true },
      orderBy: { itemNo: 'asc' },
      select: { id: true, itemNo: true, sceneName: true, status: true, priority: true, progress: true, timeSavedHours: true },
    });
    return res.json(scenes);
  }

  res.status(400).json({ error: '參數 level 必須是 division | department | section' });
};

exports.executionTable = async (req, res) => {
  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          sections: {
            include: {
              scenes: {
                where: { active: true },
                select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, timeSavedHours: true, priority: true },
              },
            },
          },
          scenes: {
            where: { active: true, sectionId: null },
            select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, timeSavedHours: true, priority: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(divisions);
};

// ── 內部輔助 ──────────────────────────────────────────────
async function getKpiStats() {
  const [totalScenes, completedScenes, inProgressScenes, configs] = await Promise.all([
    prisma.scene.count({ where: { active: true } }),
    prisma.scene.count({ where: { active: true, status: '已完成' } }),
    prisma.scene.count({ where: { active: true, status: '進行中' } }),
    prisma.systemConfig.findMany(),
  ]);

  const configMap = {};
  for (const c of configs) configMap[c.key] = c.value;

  const timeSums = await prisma.scene.aggregate({
    where: { active: true },
    _sum: { timeSavedHours: true, actualTimeSavedHours: true },
  });

  return {
    totalScenes,
    completedScenes,
    inProgressScenes,
    plannedScenes: totalScenes - completedScenes - inProgressScenes,
    targetScenes: parseInt(configMap.target_scenes || '100'),
    estimatedTimeSaved: timeSums._sum.timeSavedHours || 0,
    actualTimeSaved: timeSums._sum.actualTimeSavedHours || 0,
    targetHours: parseInt(configMap.target_hours || '10000'),
    completionRate: totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0,
  };
}
