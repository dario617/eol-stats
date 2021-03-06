from datetime import datetime
import pytz
from django.db.models import Sum
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, generics, filters, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from visits.models import VisitOnPage
from visits.serializers import VisitOnPageSerializer
from core.authentication import recoverUserCourseRoles


class VisitOnPageViewSet(generics.ListAPIView, viewsets.ModelViewSet):
    """
    API that recovers a list of Visits per page
    """
    queryset = VisitOnPage.objects.all()
    serializer_class = VisitOnPageSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['username']
    filterset_fields = ['course', 'time']


@api_view()
def visits_on_course(request):
    """
    Compact user visits per verticals by days

    Expects 3 query parameters
    - search: course id in block-v1:COURSE+type@course+block@course format
    - llimit (lower limit): a string datetime in isoformat
    - rlimit (upper limit): a string datetime in isoformat
    both timestamps are included on the query.

    Timezone is added on runtime
    """
    roles = recoverUserCourseRoles(request)
    allowed_list = [r['course_id'].replace(
        "course", "block") for r in roles['roles'] if r['role'] in settings.BACKEND_ALLOWED_ROLES]

    if "search" not in request.query_params:
        return Response(status=status.HTTP_400_BAD_REQUEST, data="Search field required")

    if "llimit" not in request.query_params:
        return Response(status=status.HTTP_400_BAD_REQUEST, data="Lower limit field required")

    if "ulimit" not in request.query_params:
        return Response(status=status.HTTP_400_BAD_REQUEST, data="Upper limit field required")

    tz = pytz.timezone(settings.TIME_ZONE)
    try:
        llimit = tz.localize(datetime.fromisoformat(
            request.query_params["llimit"].replace("Z", "")))
        ulimit = tz.localize(datetime.fromisoformat(
            request.query_params["ulimit"].replace("Z", "")))
    except Exception as time_error:
        return Response(status=status.HTTP_400_BAD_REQUEST, data="Error while formating time limits. Expects isoformat.")

    if llimit > ulimit:
        return Response(status=status.HTTP_400_BAD_REQUEST, data="lower limit does not preceed upper limit")

    # Check that user has permissions
    if request.query_params["search"] not in allowed_list:
        return Response(status=status.HTTP_403_FORBIDDEN, data="No tiene permisos para ver los datos en los cursos solicitados")

    # Course will arrive in format block-v1:COURSE without +type@course-block@course
    # hence we do a icontains query
    visits = VisitOnPage.objects.filter(
        course__icontains=request.query_params["search"],
        time__lte=ulimit,
        time__gte=llimit
    ).values("username", "vertical", "sequential", "chapter", "course").order_by("username", "vertical").annotate(total=Sum("count"))
    if len(visits) == 0:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(visits)
