import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ExercisesService } from './exercises.service';
import { ExerciseSearchDto } from './exercises.dto';

@Controller('exercises')
@UseGuards(AuthGuard)
export class ExercisesController {
  constructor(private exercises: ExercisesService) {}

  @Get()
  search(@Query() q: ExerciseSearchDto) {
    return this.exercises.search(q.q, q.muscle, q.equipment, 50, q.pattern);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.exercises.get(id);
  }
}
