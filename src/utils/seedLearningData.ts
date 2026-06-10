import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import Journey from '../models/Journey';
import Episode, { IActivity } from '../models/Episode';
import Badge from '../models/Badge';
import { logger } from './logger';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infano';

const createActivityList = (episodeNum: number, episodeTitle: string): IActivity[] => {
  return [
    {
      _id: new Types.ObjectId(),
      type: 'intro_video',
      order: 1,
      xp_value: 5,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        video_url: 'https://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8',
        thumbnail_url: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e',
        duration_seconds: 90,
        caption: `Welcome to ${episodeTitle}!`,
        facts: [
          "Understanding your body's rhythm can increase energy levels by up to 20%.",
          "Your cycle is a vital sign, just like your heart rate and blood pressure.",
          "Over 80% of women report feeling more empowered after tracking their daily symptoms."
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'story_card',
      order: 2,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        cards: [
          {
            character_name: 'Maya',
            character_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
            text: 'I used to feel so nervous when my period was due. I did not know what to expect.',
            illustration_url: 'https://images.unsplash.com/photo-1544026053-294711f11463',
            bg_color: '#FDF2F8'
          },
          {
            character_name: 'Maya',
            character_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
            text: 'But learning about my cycle helped me understand that my body is just doing its natural job.',
            illustration_url: 'https://images.unsplash.com/photo-1518152006812-edab29b069ac',
            bg_color: '#F5F3FF'
          }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'image_paragraph',
      order: 3,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
        image_alt: 'Cycle Phases Diagram',
        heading: 'Understanding the Foundations',
        body_text: 'The menstrual cycle is more than just your period. It is a series of hormonal changes designed to prepare the body for potential pregnancy. It is regulated by gland signals, primarily originating in the brain and ovaries, coordinating a complex cycle split into four distinct phases.',
        source_credit: 'Infano Medical Advisory Board'
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'character_dialogue',
      order: 4,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        characters: [
          { name: 'Riya', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
          { name: 'Dr. Kavita', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2' }
        ],
        dialogue: [
          { character: 'Riya', line: 'Dr. Kavita, why do I feel so moody right before my period starts?', expression: 'confused' },
          { character: 'Dr. Kavita', line: 'That is very common, Riya! Progesterone levels drop quickly right before your period, which can affect serotonin, our happy hormone.', expression: 'reassuring' }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'multiple_choice',
      order: 5,
      xp_value: 15,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        instructions: 'Test your understanding on basic cycle patterns.',
        questions: [
          {
            question: 'What is the average length of a menstrual cycle?',
            options: ['14 days', '28 days', '45 days', '7 days'],
            correct_index: 1,
            explanation: 'While average cycle length is 28 days, a normal range is between 21 and 35 days.'
          }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'journal_entry',
      order: 6,
      xp_value: 15,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        prompt: 'What did you learn about your body today that surprised you?',
        sub_prompts: ['How did this shift your perspective?', 'What is one change you want to make?'],
        min_words: 5,
        placeholder_text: 'Reflect and write here...'
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'assessment',
      order: 7,
      xp_value: 30,
      is_required: true,
      estimated_minutes: 5,
      payload: {
        instructions: 'Answer correctly to complete the episode assessment.',
        time_limit_minutes: 10,
        questions: [
          {
            question: 'Which hormone drop triggers menstruation?',
            options: ['Estrogen', 'Progesterone', 'Testosterone', 'Thyroxine'],
            correct_index: 1,
            explanation: 'The drop in progesterone at the end of the luteal phase triggers the shedding of the uterine lining (menstruation).'
          },
          {
            question: 'How long does a typical period flow last?',
            options: ['1 day', '3 to 7 days', '10 to 14 days', 'Over 20 days'],
            correct_index: 1,
            explanation: 'A normal period bleed usually lasts between 3 and 7 days.'
          }
        ],
        pass_threshold: 0.70
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'summary_card',
      order: 8,
      xp_value: 5,
      is_required: true,
      estimated_minutes: 1,
      payload: {
        key_learnings: [
          'The cycle averages 28 days, but variations are normal.',
          'Hormonal drops trigger the menstrual phase.',
          'Self-reflection helps identify personal patterns.'
        ],
        next_episode_title: `Episode ${episodeNum + 1}`,
        next_episode_teaser: 'Let us dive deeper into logs and calculations!'
      }
    }
  ];
};

export const seedLearningData = async () => {
  try {
    logger.info('Starting learning content seeding...');

    // Clear existing content to ensure clean seeds
    await Journey.deleteMany({});
    await Episode.deleteMany({});
    await Badge.deleteMany({});
    logger.info('Cleared existing journeys, episodes, and badges.');

    // 1. Create Badges
    const badge = await Badge.create({
      name: 'Journey Champion',
      description: 'Completed a Learning Journey.',
      image_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
      type: 'journey_completion',
      criteria: { type: 'any' }
    });
    logger.info('Created Badges.');

    const journeyData = [
      { title: 'My Body, My Story', slug: 'my-body-my-story', desc: 'A foundational guide to your body.', category: 'adolescent', cover: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74' },
      { title: 'Understanding Your Cycle', slug: 'understanding-your-cycle', desc: 'A comprehensive guide to the adult menstrual cycle.', category: 'menstrual_health', cover: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773' },
      { title: 'Nutrition & Cycle Health', slug: 'nutrition-and-cycle', desc: 'How to nourish your body across the four phases.', category: 'nutrition', cover: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061' },
      { title: 'Fertility & Conception', slug: 'fertility-conception', desc: 'Basics of tracking ovulation and fertility awareness.', category: 'reproductive', cover: 'https://images.unsplash.com/photo-1518152006812-edab29b069ac' },
      { title: 'Navigating Menopause', slug: 'navigating-menopause', desc: 'Preparing for and managing perimenopause transitions.', category: 'reproductive', cover: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2' }
    ];

    for (let i = 0; i < journeyData.length; i++) {
      const data = journeyData[i];
      const isFirst = (i === 0);

      const journey = await Journey.create({
        title: data.title,
        slug: data.slug,
        description: data.desc,
        cover_image_url: data.cover,
        category: data.category,
        target_audience: ['13-35'],
        tier_required: 'plus', // ALL journeys are premium
        completion_badge_id: badge._id,
        estimated_hours: 1.5,
        is_featured: isFirst, // First journey featured
        language: 'en',
        status: 'published',
        total_xp: 300,
        // use created_at to force sorting arrangement: newest first (so index 0 is newest)
        created_at: new Date(Date.now() - i * 100000) 
      });

      const episodeNames = [
        ['The Basics of Your Body', 'Hormonal Rhythms', 'Building Healthy Habits'],
        ['Cycle Phases Explained', 'Tracking Your Symptoms', 'Emotional Wellness'],
        ['Nutritional Needs', 'Handling Cravings', 'Supplements & You'],
        ['Ovulation 101', 'Timing and Conception', 'Preconception Health'],
        ['Perimenopause Signs', 'Managing Symptoms', 'Long-term Vitality']
      ];

      const episodeIds = [];
      for (let ep = 1; ep <= 3; ep++) {
        // ONLY the first journey's first two episodes are free
        const isFree = isFirst && (ep === 1 || ep === 2);
        
        const epTitle = episodeNames[i]?.[ep - 1] || `Episode ${ep}`;

        const episode = await Episode.create({
          journey_id: journey._id,
          order: ep,
          title: epTitle,
          description: `Learn the key concepts for: ${epTitle}.`,
          thumbnail_url: data.cover,
          duration_minutes: 20,
          total_xp: 100,
          is_free: isFree,
          pass_threshold: 0.70,
          activities: createActivityList(ep, epTitle),
          status: 'published'
        });
        episodeIds.push(episode._id);
      }

      journey.episode_ids = episodeIds as any;
      await journey.save();
      logger.info(`Seeded Journey ${i + 1}: ${data.title} (${isFirst ? 'First 2 Eps Free' : 'All Paid'})`);
    }

    logger.info('Learning Journey data seeded successfully! 5 Journeys created.');
  } catch (error: any) {
    logger.error(`Failed to seed learning content: ${error.message}`);
    throw error;
  }
};

// If executing directly via node command line
if (require.main === module) {
  const runSeeding = async () => {
    try {
      await mongoose.connect(MONGO_URI);
      logger.info('Database connected for standalone seed script execution.');
      await seedLearningData();
      await mongoose.disconnect();
      logger.info('Database disconnected. Seeding execution complete.');
      process.exit(0);
    } catch (err: any) {
      logger.error(`Seed script standalone execution failure: ${err.message}`);
      process.exit(1);
    }
  };
  runSeeding();
}
