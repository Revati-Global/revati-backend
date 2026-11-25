import { pool } from '../src/config/db.js';

async function updateStatusAndProjects() {
  await pool.query(`UPDATE public.testimonials SET status = 1;`);
  await pool.query(`UPDATE public.projects SET status = 1;`);

  // Insert rich projects from Futuretek projectList.js
  const extraProjects = [
    {
      slug: 'regulatory-compliance-thermal-system',
      title: 'Regulatory Compliance Thermal System',
      image: '/images/img/projects/project1.jpg',
      location: 'Kolkata, West Bengal',
      project_type: 'Industrial Thermal',
      description: 'Turnkey thermal engineering and regulatory steam compliance system engineered for large-scale industrial manufacturing.'
    },
    {
      slug: 'commercial-steam-recovery-plant',
      title: 'Commercial Steam Recovery Plant',
      image: '/images/img/projects/project2.jpg',
      location: 'Howrah Industrial Belt, Kolkata',
      project_type: 'Energy Management',
      description: 'High-efficiency condensate and flash steam heat recovery network integrated into process pipelines.'
    },
    {
      slug: 'cleanroom-climate-engineering-facility',
      title: 'Cleanroom Climate Engineering Facility',
      image: '/images/img/projects/project3.jpg',
      location: 'Salt Lake Sector V, Kolkata',
      project_type: 'Cleanroom HVAC',
      description: 'Precision environmental validation and aseptic climate control system for pharmaceutical packaging.'
    },
    {
      slug: 'industrial-process-heating-infrastructure',
      title: 'Industrial Process Heating Infrastructure',
      image: '/images/img/projects/project4.jpg',
      location: 'Durgapur Industrial Complex, West Bengal',
      project_type: 'Boilers & Heaters',
      description: 'Heavy-duty thermic fluid heating unit with automated modulation and low emissions burners.'
    },
    {
      slug: 'turnkey-hydronic-piping-network',
      title: 'Turnkey Hydronic Piping Network',
      image: '/images/img/projects/project5.jpg',
      location: 'Haldia Petrochemical Hub, West Bengal',
      project_type: 'Piping & Valves',
      description: 'ASME-compliant high-pressure hydronic distribution loop with precision flow regulation.'
    }
  ];

  for (const p of extraProjects) {
    await pool.query(`
      INSERT INTO public.projects (slug, user_id, title, location, project_type, image, description, status, created_at, updated_at)
      VALUES ($1, 1, $2, $3, $4, $5, $6, 1, now(), now())
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        location = EXCLUDED.location,
        project_type = EXCLUDED.project_type,
        image = EXCLUDED.image,
        description = EXCLUDED.description,
        status = 1;
    `, [p.slug, p.title, p.location, p.project_type, p.image, p.description]);
  }

  console.log('✓ Successfully activated testimonials and seeded rich Kolkata projects!');
  process.exit(0);
}

updateStatusAndProjects().catch(err => {
  console.error(err);
  process.exit(1);
});
