require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Job = require('./models/Job');
const Project = require('./models/Project');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🌱 Seeding database...');

  // Clear collections
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Job.deleteMany({});
  await Project.deleteMany({});

  // Create admin
  const admin = await User.create({ name: 'Admin User', email: 'admin@raxwo.com', password: 'Admin@2026', role: 'admin', isActive: true });

  // Create manager
  const manager = await User.create({ name: 'Rashin Sheran', email: 'manager@raxwo.com', password: 'Manager@2026', role: 'manager', isActive: true });

  // Create developers
  const emp1User = await User.create({ name: 'John Developer', email: 'john@raxwo.com', password: 'Employee@2026', role: 'developer', isActive: true });
  const emp2User = await User.create({ name: 'Nimal Silva', email: 'nimal@raxwo.com', password: 'Employee@2026', role: 'developer', isActive: true });

  const designerUser = await User.create({ name: 'Alex Designer', email: 'designer@raxwo.com', password: 'Designer@2026', role: 'designer', isActive: true });
  const marketingUser = await User.create({ name: 'Maya Marketing', email: 'marketing@raxwo.com', password: 'Marketing@2026', role: 'marketing', isActive: true });

  // Create employee profiles
  const emp1 = await Employee.create({
    userId: emp1User._id, employeeNo: 'EMP0001', department: 'Engineering',
    designation: 'Senior Software Engineer', basicSalary: 150000, allowances: 20000,
    epfNumber: 'EPF001', joinedDate: new Date('2023-01-15'), manager: manager._id, status: 'active',
    skills: ['React', 'Node.js', 'MongoDB'], gender: 'male',
  });

  const emp2 = await Employee.create({
    userId: emp2User._id, employeeNo: 'EMP0002', department: 'Engineering',
    designation: 'Junior Software Engineer', basicSalary: 80000, allowances: 10000,
    epfNumber: 'EPF002', joinedDate: new Date('2024-03-01'), manager: manager._id, status: 'active',
    skills: ['React', 'JavaScript', 'CSS'], gender: 'male',
  });

  await Employee.create({
    userId: designerUser._id, employeeNo: 'EMP0003', department: 'Design',
    designation: 'UI/UX Designer', basicSalary: 95000, allowances: 12000,
    joinedDate: new Date('2024-06-01'), manager: manager._id, status: 'active',
    skills: ['Figma', 'CSS', 'HTML'], gender: 'female',
  });

  await Employee.create({
    userId: marketingUser._id, employeeNo: 'EMP0004', department: 'Marketing',
    designation: 'Marketing Executive', basicSalary: 85000, allowances: 10000,
    joinedDate: new Date('2024-08-01'), manager: manager._id, status: 'active',
    skills: ['SEO', 'Social Media'], gender: 'female',
  });

  // Create client
  const clientUser = await User.create({ name: 'TechCorp Lanka', email: 'client@techcorp.lk', password: 'Client@2026', role: 'client', isActive: true });

  // Create jobs
  await Job.create([
    {
      title: 'Full Stack Developer', department: 'Engineering', type: 'full-time',
      description: 'We are looking for an experienced Full Stack Developer to join our team at Raxwo Pvt Ltd.',
      requirements: ['3+ years experience', 'Strong React.js skills', 'Node.js proficiency'],
      skills: ['react', 'node', 'mongodb', 'javascript', 'rest'],
      salaryRange: { min: 100000, max: 180000 },
      deadline: new Date('2026-07-31'), status: 'open', postedBy: admin._id,
    },
    {
      title: 'UI/UX Designer', department: 'Design', type: 'full-time',
      description: 'Creative UI/UX Designer needed to craft beautiful, user-centric digital experiences.',
      requirements: ['2+ years experience', 'Proficiency in Figma', 'Strong portfolio'],
      skills: ['figma', 'css', 'html', 'bootstrap'],
      salaryRange: { min: 70000, max: 120000 },
      deadline: new Date('2026-07-15'), status: 'open', postedBy: admin._id,
    },
    {
      title: 'DevOps Engineer', department: 'Infrastructure', type: 'full-time',
      description: 'DevOps Engineer to manage our cloud infrastructure and CI/CD pipelines.',
      requirements: ['3+ years DevOps', 'AWS/Azure experience', 'Docker & Kubernetes'],
      skills: ['docker', 'kubernetes', 'aws', 'linux', 'ci/cd'],
      salaryRange: { min: 130000, max: 200000 },
      deadline: new Date('2026-08-01'), status: 'open', postedBy: admin._id,
    },
  ]);

  // Create project
  await Project.create({
    title: 'TechCorp ERP System', description: 'Full ERP system development for TechCorp Lanka',
    client: clientUser._id, projectManager: manager._id,
    assignedEmployees: [emp1User._id, emp2User._id],
    status: 'active', priority: 'high', budget: 2500000,
    startDate: new Date('2026-01-01'), deadline: new Date('2026-08-31'),
    progress: 35, technologies: ['React', 'Node.js', 'MongoDB'],
    milestones: [
      { title: 'Requirements Analysis', dueDate: new Date('2026-02-01'), completed: true },
      { title: 'UI/UX Design', dueDate: new Date('2026-03-15'), completed: true },
      { title: 'Backend API Development', dueDate: new Date('2026-05-31'), completed: false },
      { title: 'Frontend Integration', dueDate: new Date('2026-07-15'), completed: false },
      { title: 'Testing & Deployment', dueDate: new Date('2026-08-31'), completed: false },
    ],
  });

  console.log('✅ Seed completed!');
  console.log('👤 Admin: admin@raxwo.com / Admin@2026');
  console.log('👤 Manager: manager@raxwo.com / Manager@2026');
  console.log('👤 Developer: john@raxwo.com / Employee@2026');
  console.log('👤 Developer: nimal@raxwo.com / Employee@2026');
  console.log('👤 Designer: designer@raxwo.com / Designer@2026');
  console.log('👤 Marketing: marketing@raxwo.com / Marketing@2026');
  console.log('👤 Client: client@techcorp.lk / Client@2026');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
